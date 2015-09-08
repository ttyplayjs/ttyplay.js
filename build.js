#!/usr/bin/env node

//
// requires
//

var
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp').sync,
  rmrf = require('rimraf').sync,
  jsProcessor = require('uglify-js'),
  scssProcessor = require('node-sass');

//
// config
//

var
  jsConfig = {
    fromString    : true,
    output        : {
      comments      : /@license/,
      bracketize    : true,
      indent_level  : 2
    }
  },
  distDir = path.join(__dirname, 'dist');

//
// utility functions
//

function read(filename) {
  return fs.readFileSync(filename).toString();
}

function write(filename, data) {
  return fs.writeFileSync(filename, data);
}

function concat() {
  var result = '';

  for (var i = 0, length = arguments.length; i < length; ++i) {
    var
      filename = arguments[i],
      relativePath = '.' + filename.slice(__dirname.length);

    result += '/** ' + relativePath + ' */\n';
    result += read(filename);
    result += '\n\n';
  }

  return result;
}

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

function js(code, options) {
  return jsProcessor.minify(code, extend(jsConfig, options));
}

function scss(file, options) {
  options = extend({
    file: file
  }, options);

  var result = scssProcessor.renderSync(options);

  // fix indentation
  if (options.indentedSyntax) {
    var
      lines = result.css.toString().replace(/\n$/, '').split("\n"),
      newLines = [];

    for (var i = 0, length = lines.length; i < length; ++i) {
      var line = lines[i];

      if (line.slice(-2) == ' }') {
        var
          prevLine = lines[i - 1],
          indent = prevLine.match(/^ +/)[0];

        newLines.push(line.slice(0, -2));
        newLines.push(indent.slice(0, -2) + '}');
        newLines.push('');
      } else {
        newLines.push(line);
      }
    }

    result.css = new Buffer(newLines.join('\n'));
  }

  return result;
}


//
// build
//

rmrf(distDir);
mkdirp(distDir);

// javascripts
write(path.join(distDir, 'ttyplay.js'),
  read(path.join(__dirname, 'src', 'javascripts', 'ttyplay.js')));
write(path.join(distDir, 'ttyplay.min.js'),
  js(read(path.join(__dirname, 'src', 'javascripts', 'ttyplay.js'))).code);
write(path.join(distDir, 'ttyplay-with-dependencies.js'),
  concat(
    path.join(__dirname, 'vendor', 'javascripts', 'term.js'),
    path.join(__dirname, 'vendor', 'javascripts', 'pako_inflate.js'),
    path.join(__dirname, 'src', 'javascripts', 'ttyplay.js')));
write(path.join(distDir, 'ttyplay-with-dependencies.min.js'),
  js(concat(
    path.join(__dirname, 'vendor', 'javascripts', 'term.js'),
    path.join(__dirname, 'vendor', 'javascripts', 'pako_inflate.js'),
    path.join(__dirname, 'src', 'javascripts', 'ttyplay.js'))).code);

// stylesheets
write(path.join(distDir, 'ttyplay.scss'),
  read(path.join(__dirname, 'src', 'stylesheets', 'ttyplay.scss')));
write(path.join(distDir, 'ttyplay.css'),
  scss(path.join(__dirname, 'src', 'stylesheets', 'ttyplay.scss'), { indentedSyntax: true }).css.toString());
write(path.join(distDir, 'ttyplay.min.css'),
  scss(path.join(__dirname, 'src', 'stylesheets', 'ttyplay.scss'), { outputStyle: 'compressed' }).css.toString());
