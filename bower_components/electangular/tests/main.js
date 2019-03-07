const electron = require('electron');
const {app} = electron;
const {BrowserWindow} = electron;
const {ipcMain} = electron;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600
  });

  win.loadURL(`file://${__dirname}/index.html`);

  win.webContents.openDevTools();

  win.on('closed', () => {
    win = null;
  });

  ipcMain.on('electron-msg', (event, arg) => {
    console.log('main-> ' + arg);
    win.webContents.send('electron-msg', arg);
  });

}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
