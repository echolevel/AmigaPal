'use strict';

var _require = require('electron'),
    app = _require.app,
    BrowserWindow = _require.BrowserWindow;

var path = require('path');
var url = require('url');
var protocol = require('electron').protocol;

var win = void 0;

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 830,
    minWidth: 600,
    maxWidth: 600,
    minHeight: 830,
    maxHeight: 830,
    webPreferences: {
      webSecurity: false,
      allowRunningInsecureContent: true
    }
    //,minHeight: 500
    //,maxWidth: 940
  });

  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file',
    slashes: true
  }));

  //win.webContents.openDevTools({mode: 'bottom'});

  win.on('closed', function () {
    win = null;
  });

  protocol.interceptFileProtocol('file', function(req, callback) {
    var url = req.url.substr(7);
    callback({path: path.normalize(__dirname + url)})
  }, function(error) {
    if(error) {
      console.error('Failed to register protocol')
    }
  })

}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (win === null) {
    createWindow();
  }
});
