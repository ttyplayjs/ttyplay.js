/**
 * ttyplay.js - ttyrec player for the browser
 * Copyright (c) 2015 Latchezar Tzvetkoff (MIT License)
 * https://github.com/ttyplay/ttyplay.js

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @license
 */

/**
 * @namespace
 */
;(function(global, undefined) {
  /**
   * Extend a destination object with the properties of multiple sources
   * @param {Object} destination  - The destination object to extend
   * @param {...Object} sources   - The sources to get properties from
   * @returns {Object} The extended object
   */
  function extend(destination) {
    for (var i = 1, length = arguments.length; i < length; ++i) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          destination[key] = source[key];
        }
      }
    }

    return destination;
  }

  /**
   * Parse a Little-endian DWORD from array
   * @param {Uint8Array} array  - The byte array
   * @param {Number} offset     - Array offset
   * @returns {Number} The number parsed
   */
  function parseLittleEndianDWORD(array, offset) {
    return array[offset + 3] * 16777216 +
           array[offset + 2] * 65536 +
           array[offset + 1] * 256 +
           array[offset];
  }

  /**
   * Builds a DOM node
   * @param {String} tagName        - Node tag
   * @param {Object} attributes     - Node attributes
   * @param {Array|Element|String}  - children Node children
   * @returns {Element} DOM node
   */
  function buildNode(tagName, attributes, children) {
    var node = document.createElement(tagName);

    /* Apply attributes */
    if (attributes) {
      for (var attribute in attributes) {
        if (attributes.hasOwnProperty(attribute)) {
          node[attribute] = attributes[attribute];
        }
      }
    }

    /* Append children */
    if (children) {
      if (typeof children === 'string') {
        node.appendChild(document.createTextNode(children));
      } else if (children.tagName) {
        node.appendChild(children);
      } else if (children.length) {
        for (var i = 0, length = children.length; i < length; ++i) {
          var child = children[i];

          if (typeof child === 'string') {
            child = document.createTextNode(child);
          }

          node.appendChild(child);
        }
      }
    }

    return node;
  }

  /**
   * TTYPlay
   * @class
   * @name TTYPlay
   * @param {String|Element} container  - The DOM container
   * @param {Object} options            - Player options (see {@link TTYPlay.defaultOptions})
   */
  function TTYPlay(container, options) {
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }
    this.container = container;

    options = extend({}, TTYPlay.defaultOptions, options || {});
    this.options = options;

    this.position = this.options.position;

    this.initializeTerminal();

    if (options.controls) {
      this.initializeControls();
    }

    if (options.url) {
      this.loadUrl(options.url);
    } else if (options.rawTtyRecord) {
      this.loadRawTtyRecord(options.rawTtyRecord, options.gzip);

      if (options.auto) {
        this.start();
      }
    } else if (options.ttyFrames) {
      this.ttyFrames = options.ttyFrames;

      if (options.auto) {
        this.start();
      }
    } else {
      throw 'No data to replay!';
    }
  }

  /**
   * Default player options
   * @name TTYPlay.defaultOptions
   * @type {Object}
   * @property {String} url               - URL to fetch raw TTY record from (default: <code>null</code>)
   * @property {Uint8Array} rawTtyRecord  - Raw TTY record data (default: <code>null</code>)
   * @property {Boolean} gzip             - Whether the raw TTY record data is GZip'ped (default: <code>false</code>)
   * @property {Array} ttyFrames          - Pre-parsed TTY record frames array (default: <code>null</code>)
   * @property {Boolean} precompose       - Precompose TTY frames for faster <code>redraw()/jump()</code> (default: <code>false</code>)
   * @property {Number} cols              - Terminal columns (default: <code>80</code>)
   * @property {Number} rows              - Terminal rows (default: <code>25</code>)
   * @property {Number} speed             - Playback speed (default: <code>1.0</code>)
   * @property {Boolean} auto             - Auto-play (default: <code>false</code>)
   * @property {Boolean} repeat           - Auto-repeat (default: <code>false</code>)
   * @property {Number} position          - Initial position (default: <code>0</code>)
   * @property {Boolean} controls         - Whether to build controls (default: <code>true</code>)
   */
  TTYPlay.defaultOptions = {
    url           : null,
    rawTtyRecord  : null,
    gzip          : false,
    ttyFrames     : null,
    precompose    : false,
    cols          : 80,
    rows          : 25,
    speed         : 1.0,
    auto          : false,
    repeat        : false,
    position      : 0,
    controls      : true
  };

  /**
   * Decompresses GZip'ped data (defaults to <code>pako.ungzip()</code>)
   * @memberof TTYPlay
   * @static
   * @param {Uint8Array} data - Raw data
   * @returns {Uint8Array} Decompressed data
   */
  TTYPlay.ungzip = function(data) {
    return pako.ungzip(data);
  };

  /**
   * Destroys TTYPlay
   * @memberof TTYPlay
   */
  TTYPlay.prototype.destroy = function() {
    if (this.terminal && this.terminal.element) {
      this.terminal.element.parentNode.removeChild(this.terminal.element);
      this.terminal.element = null;
      this.terminal = null;
    }
    if (this.controls && this.controls.container) {
      this.controls.container.parentNode.removeChild(this.controls.container);
      this.controls = null;
    }
  };

  /**
   * Initializes terminal
   * @memberof TTYPlay
   */
  TTYPlay.prototype.initializeTerminal = function() {
    this.terminal = new Terminal({
      cols        : this.options.cols,
      rows        : this.options.rows,
      parent      : this.container,
      cursorBlink : false
    });

    /* Prevent cursor from hiding and kill key hooks */
    this.terminal.blur =
    this.terminal.keyDown =
    this.terminal.keyPress =
      function() {};

    /* Open terminal */
    this.terminal.open();
  };

  /**
   * Initializes controls
   * @memberof TTYPlay
   */
  TTYPlay.prototype.initializeControls = function() {
    var _this = this;
    var playFunc = function() {
      if (!_this.running) {
        _this.start();
        _this.controls.play.className = 'pause';
        _this.controls.play.innerHTML = 'Pause';
      } else if (_this.paused) {
        _this.resume();
        _this.controls.play.className = 'pause';
        _this.controls.play.innerHTML = 'Pause';
      } else {
        _this.pause();
        _this.controls.play.className = 'play';
        _this.controls.play.innerHTML = 'Play';
      }
    };
    var stopFunc = function() {
      _this.stop();
      _this.controls.play.className = 'play';
      _this.controls.play.innerHTML = 'Play';
    };
    var jumpFunc = function(event) {
      clearTimeout(_this.lastTimeout);

      var position = Math.round(_this.ttyFrames.length * event.offsetX / _this.controls.progressWrapper.offsetWidth);
      _this.jump(position);

      /* Lazily queue next frame */
      if (_this.running && !_this.paused) {
        _this.resume();
      }
    };

    var controls = {};
    this.controls = controls;

    /* Build progress bar and wrapper */
    controls.progressBar = buildNode('span');
    controls.progressWrapper = buildNode('span', { className: 'progress', onclick: jumpFunc }, [
      controls.progressBar
    ]);

    /* Build start/pause/resume and stop buttons */
    controls.play = buildNode('a', { href: 'javascript:;', className: 'play', onclick: playFunc }, 'Play');
    controls.stop = buildNode('a', { href: 'javascript:;', className: 'stop', onclick: stopFunc }, 'Stop');

    /* Build container and add it to the main container */
    controls.container = buildNode('span', { className: 'controls' }, [
      controls.progressWrapper,
      controls.play,
      controls.stop
    ]);

    this.container.appendChild(controls.container);
  };

  /**
   * Updates progress-bar progress
   * @memberof TTYPlay
   */
  TTYPlay.prototype.updateProgressBar = function() {
    if (this.options.controls) {
      var progress = Math.round(100 * this.position / this.ttyFrames.length);
      this.controls.progressBar.style.width = progress + '%';
    }
  };

  /**
   * Loads TTY record from URL
   * @memberof TTYPlay
   * @param {String} url  - The URL to load raw TTY record from
   */
  TTYPlay.prototype.loadUrl = function(url) {
    var _this = this, xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.responseType = 'arraybuffer';

    xhr.onload = function() {
      _this.loadRawTtyRecord(new Uint8Array(this.response), _this.options.gzip);

      if (_this.options.auto) {
        _this.start();
      }
    };

    xhr.send(null);
  };

  /**
   * Parses raw TTY record data
   * @memberof TTYPlay
   * @param {Uint8Array} array  - Raw TTY record byte array
   * @param {Boolean} gzip      - Whether the raw TTY record data is GZip'ped
   */
  TTYPlay.prototype.loadRawTtyRecord = function(array, gzip) {
    if (gzip) {
      array = TTYPlay.ungzip(array);
    }

    var ttyFrames = [];

    var offset = 0, length = array.byteLength;
    var prevSec = parseLittleEndianDWORD(array, 0);
    var prevUsec = parseLittleEndianDWORD(array, 4);

    while (offset < length) {
      var sec = parseLittleEndianDWORD(array, offset);
      var usec = parseLittleEndianDWORD(array, offset + 4);
      var time = (sec - prevSec) + (usec - prevUsec) * 0.000001;

      prevSec = sec;
      prevUsec = usec;

      var size = parseLittleEndianDWORD(array, offset + 8);
      var subarray = array.subarray(offset + 12, offset + 12 + size);
      var encodedData = String.fromCharCode.apply(null, subarray);
      var decodedData = decodeURIComponent(escape(encodedData));

      var fullData = null;
      if (this.options.precompose) {
        if (ttyFrames.length) {
          fullData = ttyFrames[ttyFrames.length - 1].fullData + decodedData;
        } else {
          fullData = decodedData;
        }
      }

      ttyFrames.push({
        index     : ttyFrames.length,
        time      : time,
        size      : size,
        frameData : decodedData,
        fullData  : fullData
      });

      offset += 12 + size;
    }

    this.ttyFrames = ttyFrames;
  };

  /**
   * Starts playback
   * @memberof TTYPlay
   */
  TTYPlay.prototype.start = function() {
    /* Set state to playing */
    this.running = true;
    this.paused = false;

    /* Redraw current frame */
    var thisFrame = this.ttyFrames[this.position];
    if (thisFrame) {
      this.redraw(thisFrame);
    }

    /* Queue next frame */
    var nextFrame = this.ttyFrames[this.position + 1];
    if (nextFrame) {
      var _this = this;
      this.lastTimeout = setTimeout(function() {
        ++_this.position;
        _this.tick();
      }, nextFrame.time * 1000 * this.options.speed);
    }

    /* Update controls */
    if (this.controls && this.controls.play) {
      this.controls.play.className = 'pause';
      this.controls.play.innerHTML = 'Pause';
    }
  };

  /**
   * Stops playback
   * @memberof TTYPlay
   */
  TTYPlay.prototype.stop = function() {
    /* Stop the playback, reset the terminal, update progress, etc... */
    this.running = false;
    this.paused = false;
    this.position = 0;
    this.terminal.reset();
    this.terminal.showCursor();
    this.updateProgressBar();

    /* Update controls */
    if (this.controls && this.controls.play) {
      this.controls.play.className = 'play';
      this.controls.play.innerHTML = 'Play';
    }
  };

  /**
   * Pauses playback
   * @memberof TTYPlay
   */
  TTYPlay.prototype.pause = function() {
    if (this.running) {
      /* Set state to paused */
      clearTimeout(this.lastTimeout);
      this.paused = true;

      /* Update controls */
      if (this.controls && this.controls.play) {
        this.controls.play.className = 'play';
        this.controls.play.innerHTML = 'Play';
      }
    }
  };

  /**
   * Resumes playback
   * @memberof TTYPlay
   */
  TTYPlay.prototype.resume = function() {
    if (this.running) {
      /* Set state to playing */
      clearTimeout(this.lastTimeout);
      this.paused = false;

      /* Queue next frame */
      var nextFrame = this.ttyFrames[this.position + 1];
      if (nextFrame) {
        var _this = this;
        this.lastTimeout = setTimeout(function() {
          ++_this.position;
          _this.tick();
        }, nextFrame.time * 1000 * this.options.speed);
      }

      /* Update controls */
      if (this.controls && this.controls.play) {
        this.controls.play.className = 'pause';
        this.controls.play.innerHTML = 'Pause';
      }
    }
  };

  /**
   * Redraw the screen
   * @memberof TTYPlay
   * @param {Object} thisFrame  - Optional frame object
   */
  TTYPlay.prototype.redraw = function(thisFrame) {
    if (!thisFrame) {
      thisFrame = this.ttyFrames[this.position];
    }

    if (this.terminal && this.terminal.element) {
      this.terminal.element.parentNode.removeChild(this.terminal.element);
    }

    this.initializeTerminal();
    this.terminal.showCursor();

    if (thisFrame.fullData) {
      this.terminal.write(thisFrame.fullData);
    } else {
      for (var i = 0; i <= thisFrame.index; ++i) {
        var frame = this.ttyFrames[i];
        this.terminal.write(frame.frameData);
      }
    }
  };

  /**
   * Jumps to a position
   * @memberof TTYPlay
   * @param {Number} position - The position
   */
  TTYPlay.prototype.jump = function(position) {
    this.position = position;
    this.updateProgressBar();
    this.redraw();
  };

  /**
   * Plays next frame
   * @memberof TTYPlay
   */
  TTYPlay.prototype.tick = function() {
    if (this.running && !this.paused) {
      var thisFrame = this.ttyFrames[this.position];

      if (thisFrame) {
        /* Append */
        this.updateProgressBar();
        this.terminal.write(thisFrame.frameData);

        if (!this.paused) {
          var nextFrame = this.ttyFrames[this.position + 1];
          if (nextFrame) {
            /* Queue next frame */
            var _this = this;
            this.lastTimeout = setTimeout(function() {
              ++_this.position;
              _this.tick();
            }, nextFrame.time * 1000 * this.options.speed);
          } else if (this.options.repeat) {
            /* Lazy restart */
            this.stop();
            this.start();
          } else {
            /* Set progress to 100% */
            this.position = this.ttyFrames.length;
            this.updateProgressBar();

            /* Manual stop without updateProgressBar() */
            this.position = 0;
            this.running = false;

            /* Update controls */
            if (this.controls && this.controls.play) {
              this.controls.play.className = 'play';
              this.controls.play.innerHTML = 'Play';
            }
          }
        }
      }
    }
  };

  /* Export our class */
  global.TTYPlay = TTYPlay;
})(this);
