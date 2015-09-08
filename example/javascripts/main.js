document.addEventListener('DOMContentLoaded', function() {
  window.ttyPlayers = {};

  var elements = document.querySelectorAll('.ttyplay');

  for (var i = 0, length = elements.length; i < elements.length; ++i) {
    var element = elements[i];

    if (!element.id) {
      element.id = 'ttyplay_' + ('000000' + parseInt(0x1000000 * Math.random(), 10).toString(16)).slice(-6);
    }

    window.ttyPlayers[element.id] = new TTYPlay(element, {
      url         : element.dataset.url,
      gzip        : element.dataset.gzip == true || element.dataset.gzip == 'true',
      precompose  : element.dataset.precompose == true || element.dataset.precompose == 'true',
      cols        : parseInt(element.dataset.cols) || 80,
      rows        : parseInt(element.dataset.rows) || 25,
      speed       : parseFloat(element.dataset.speed) || 1.0,
      auto        : element.dataset.auto == true || element.dataset.auto == 'true',
      repeat      : element.dataset.repeat == true || element.dataset.repeat == 'true',
      position    : parseInt(element.dataset.position) || 0,
      controls    : element.dataset.controls == true || element.dataset.controls == 'true'
    });
  }
});
