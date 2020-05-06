'use strict';

const { app, BrowserWindow, protocol } = require('electron')
const path = require('path')
const url = require('url')
const globalShortcut = require('electron').globalShortcut;

// THIS fixes the issue of local file paths not being reachable after AmigaPal has been packaged.
// No idea why, it just does.
import { addBypassChecker } from 'electron-compile';
addBypassChecker((filePath) => {
  return filePath.indexOf(app.getAppPath()) === -1 && (
      /.WAV/i.test(filePath) ||
      /.MP3/i.test(filePath) ||
      /.OGG/i.test(filePath)  ||
      /.FLAC/i.test(filePath)  ||
      /.AIFF/i.test(filePath)  ||
      /.AIF/i.test(filePath)  ||
      /.AAC/i.test(filePath)
    );
});

var win = void 0;

function createWindow() {

  win = new BrowserWindow({
    width: 600,
    height: 860,
    minWidth: 600,
    maxWidth: 600,
    minHeight: 860,
    //maxHeight: 830,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.resolve(__dirname, 'res/Icon.icns'),
    webPreferences: {
      webSecurity: false,
      allowRunningInsecureContent: true,
      nodeIntegration: true
    }
    //,minHeight: 500
    //,maxWidth: 940
  });



  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file',
    slashes: true
  }));



  globalShortcut.register('f5', function() {
		win.reload()
	})
	globalShortcut.register('CommandOrControl+R', function() {
		win.reload()
	})

  globalShortcut.register('f12', function() {
    win.webContents.openDevTools({mode: 'bottom'});
  })

  globalShortcut.register('CommandOrControl+Shift+I', function() {
    win.webContents.openDevTools({mode: 'bottom'});
  })


  //win.webContents.openDevTools({mode: 'bottom'});

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
