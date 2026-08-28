const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

let mainWindow;

function createWindow () {
  
  let realAgent = session.defaultSession.getUserAgent();
  let stealthAgent = realAgent.replace(/Electron\/\S*\s/, '');
  
  session.defaultSession.setUserAgent(stealthAgent);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    title: "GFM Engine | Command Center",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true
    }
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const url = new URL(details.url);
      if (url.hostname.includes('google.com') || url.hostname.includes('whatsapp.com')) {
        delete details.requestHeaders['sec-ch-ua'];
        delete details.requestHeaders['sec-ch-ua-mobile'];
        delete details.requestHeaders['sec-ch-ua-platform'];
      }
    } catch (e) {}
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const newHeaders = Object.assign({}, details.responseHeaders);
    delete newHeaders['x-frame-options']; delete newHeaders['X-Frame-Options'];
    delete newHeaders['content-security-policy']; delete newHeaders['Content-Security-Policy'];
    callback({ cancel: false, responseHeaders: newHeaders });
  });

  // SMART POPUP ROUTER
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.includes('readymode') || url.includes('.mp3') || url.includes('listen')) {
        return { action: 'allow' };
      }
      if (mainWindow) mainWindow.webContents.send('open-new-tab', url);
      return { action: 'deny' }; 
    });
  });

  mainWindow.loadFile('index.html');
}

// SURGICAL COOKIE PURGE PROTOCOL
ipcMain.on('clear-dialer-cookies', async (event) => {
  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.readymode.com' });
    for (const cookie of cookies) {
      let url = 'https://' + (cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain) + cookie.path;
      await session.defaultSession.cookies.remove(url, cookie.name);
    }
    const cookies2 = await session.defaultSession.cookies.get({ url: 'https://enhancedialer.readymode.com' });
    for (const cookie of cookies2) {
      let url = 'https://enhancedialer.readymode.com' + cookie.path;
      await session.defaultSession.cookies.remove(url, cookie.name);
    }
    event.reply('dialer-cookies-cleared');
  } catch (error) {
    console.error('Cookie Purge Error:', error);
    event.reply('dialer-cookies-cleared');
  }
});

app.whenReady().then(() => {
  createWindow();

  // Maps dynamically to Cmd+Space on Mac, Ctrl+Space on Windows
  globalShortcut.register('CommandOrControl+Space', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-omni-core');
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Leave app running in dock on Mac when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});