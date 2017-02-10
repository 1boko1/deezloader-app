const electron = require('electron');
const theApp = require('./app');
const appConfig = require('./config.json');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const WindowStateManager = require('electron-window-state-manager');

const path = require('path');
const url = require('url');

let mainWindow;

// Create a new instance of the WindowStateManager
const mainWindowState = new WindowStateManager('mainWindow', {
  defaultWidth: 1400,
  defaultHeight: 900
});

require('electron-context-menu')({
  showInspectElement: false
});

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    frame: false,
    icon: __dirname + "/icon.png"
  });

  mainWindow.setMenu(null);

  // and load the index.html of the app.
  mainWindow.loadURL('http://localhost:' + appConfig.serverPort);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Check if window was closed maximized and restore it
  if (mainWindowState.maximized) {
    mainWindow.maximize();
  }

  // Save current window state
  mainWindow.on('close', () => {
    mainWindowState.saveState(mainWindow);
  });
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
