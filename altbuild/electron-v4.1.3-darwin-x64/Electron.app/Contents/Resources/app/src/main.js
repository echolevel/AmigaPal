'use strict';

const { app, BrowserWindow, protocol } = require('electron')
const path = require('path')
const url = require('url')


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





  win.webContents.openDevTools({mode: 'bottom'});

  win.on('closed', function () {
    win = null;
  });




}

app.on('ready', () => {

  protocol.interceptFileProtocol('file', (request, callback) => {
    const url = request.url.substr(7)    /* all urls start with 'file://' */
    callback({ path: path.normalize(`${__dirname}/${url}`) })
  }, (err) => {
    if (err) console.error('Failed to register protocol')
  })

  createWindow()
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/*
app.on('activate', function () {
  if (win === null) {
    createWindow();
  }
});*/
