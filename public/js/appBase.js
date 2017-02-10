const shell = require('electron').shell;
const remote = require('electron').remote;
const dialog = remote.dialog;
const packageFile = remote.require('./package.json');
const mainApp = remote.require('./app');
const path = remote.require('path');

(function () {
  //open links externally by default
  $(document).on('click', 'a[href^="http"]', function (event) {
    event.preventDefault();
    shell.openExternal(this.href);
  });

  // Open DevTools when F12 is pressed
  document.addEventListener("keydown", function (e) {
    if (e.which === 123) {
      remote.getCurrentWindow().toggleDevTools();
    }
  });



  // Function to make title-bar work
  function initTitleBar() {
    let $mainEl = $('#title-bar');
    const window = remote.getCurrentWindow();

    $mainEl.find('#application_version').text(packageFile.version);

    $mainEl.find('#min-btn').on('click', function () {
      window.minimize();
    });

    $mainEl.find('#max-btn').on('click', function () {
      if (!window.isMaximized()) {
        window.maximize();
      } else {
        window.unmaximize();
      }
    });

    $mainEl.find('#close-btn').on('click', function () {
      window.close();
    });
  }

  // Setup quit button on init loader in case of fail
  $('#init-quit-btn').on('click', function (e) {
    e.preventDefault();
    remote.getCurrentWindow().close();
  });

  // Ready state of the page
  document.onreadystatechange = function () {
    if (document.readyState == "complete") {
      initTitleBar();

      $('#modal_settings_input_downloadTracksLocation').on('click', function () {
        $(this).val(dialog.showOpenDialog({
          properties: ['openDirectory']
        }));
      });
    }
  };
})(jQuery);