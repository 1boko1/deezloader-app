const electron = require('electron');
const appConfig = require('./config.json');
const {
  app,
  BrowserWindow
} = electron;
const WindowStateManager = require('electron-window-state-manager');
const path = require('path');
const url = require('url');

let mainWindow;

// create instance of WindowStateManager
const mainWindowState = new WindowStateManager('mainWindow', {
  defaultWidth: 1280,
  defaultHeight: 800
});

require('electron-context-menu')({
  showInspectElement: false
});

function createWindow() {
  // create browser window
  mainWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    frame: false,
    icon: __dirname + '../icon.png'
  });

  mainWindow.setMenu(null);
  mainWindow.openDevTools();
  // load index.html
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // dereference window on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // check if window was closed maximized and restore it
  if (mainWindow.maximized) {
    mainWindow.maximize();
  }

  // save current window state
  mainWindow.on('close', () => {
    mainWindowState.saveState(mainWindow);
  });
}

app.on('ready', createWindow);

// quit when all windows are closed
app.on('window-all-closed', () => {
  // if on osx minimize to dock, close on cmd+q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // create only if no instance is running
  if (mainWindow === null) {
    createWindow();
  }
});
