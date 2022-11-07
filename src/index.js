const {
    app,
    BrowserWindow,
    Notification
} = require('./Electron')
const {
    Client
} = require('./RPC')
const {
    NetflixParty
} = require('./NetflixParty')
const path = require('path')
const discordRegister = require('electron-discord-register')
const { setupTitlebar, attachTitlebarToWindow } = require('custom-electron-titlebar/main');
const {
    ipcMain,
    nativeImage
} = require('electron')
const { Menu } = require('electron');
app.setAppUserModelId('com.netflix.Terroriser1')

const icons = {
    win32: nativeImage.createFromPath(path.join(__dirname, `../assets/icon.png`)),
    linux: nativeImage.createFromPath(path.join(__dirname, `../assets/icon.png`)),
    darwin: nativeImage.createFromPath(path.join(__dirname, `../assets/iconmac.png`))
}
const icon = process.platform === 'win32' ? icons.win32 : process.platform === 'darwin' ? icons.darwin : icons.linux
const clientId = '868487355114323968'

// Register the application with Discord for join requests
discordRegister(clientId)

let mainWindow
const rpc = new Client({
    transport: 'ipc',
    clientId
})
const party = new NetflixParty()
let joinSession = null

rpc.on('ready', () => {
    mainWindow.checkNetflix()
    components.whenReady()
    setInterval(mainWindow.checkNetflix.bind(mainWindow), 15E3)
})

      // setup the titlebar main process
      setupTitlebar();

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        rpc,
        icon,
        party,
        titleBarStyle: 'hidden',
        frame: false, // needed if process.versions.electron < 14
        webPreferences: {
          sandbox: false,
          preload: path.join(__dirname, 'util/scripts/np_content_script.js')
        }
    })

    const menu = Menu.buildFromTemplate(exampleMenuTemplate());
    Menu.setApplicationMenu(menu);

//attach fullscreen(f11 and not 'maximized') && focus listeners
attachTitlebarToWindow(mainWindow);

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
})

    mainWindow.maximize()
    mainWindow.loadURL('https://netflix.com/browse', {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36    "
    }); //Useragent spoofing to Chrome on Windows 10

    party.ipcSetup(mainWindow)
    let navigationLoad = (loadType) => {
        // This is a bit ugly but it works
        let type = mainWindow.webContents.getURL().split('/').slice(1, 4)[2]

        mainWindow.webContents.send('np', {
            type: 'navigation',
        })

        if (type === 'watch') {
            // They're watching something so let's setup NetflixParty
            mainWindow.webContents.send('np', {
                type: 'initialize'
            })

            // Wait for NetflixParty
            ipcMain.once('npsetup', () => {
                if (loadType === 'full') {
                    if (joinSession !== null) {
                        mainWindow.webContents.send('np', {
                            type: 'joinSession',
                            data: {
                                sessionId: joinSession.id,
                                videoId: joinSession.videoId
                            }
                        })
                        joinSession = null
                    }
                }
            })
        }
    }

    mainWindow.webContents.on('did-finish-load', () => {
        navigationLoad('full')
    })

    mainWindow.webContents.on('did-navigate-in-page', () => {
        navigationLoad('inpage')
    })

    app.emit('rpc')
})

app.on('window-all-closed', () => {
    app.quit()
})

app.on('rpc', () => {
    rpc.start().then(() => {
        party.setUserDetails(rpc.user)

        rpc.subscribe('ACTIVITY_JOIN', (data) => {
            let joinDetails = Buffer.from(data.secret, 'base64').toString('ascii').split(',')
            let videoId = parseInt(joinDetails[0])
            let sessionId = joinDetails[1]

            joinSession = {
                videoId: videoId,
                id: sessionId
            }

            mainWindow.loadURL('https://netflix.com/watch/' + videoId).then(() => {
                const currentURL = mainWindow.webContents.getURL()
                console.log(currentURL)
            })
        })
    }).catch(e => {
        let notification = new Notification({
            title: 'Could not connect to Discord',
            body: 'Click here to try again',
            icon
        })

        notification.show()

        notification.on('click', () => app.emit('rpc'))
    })
})
//Will use this also for update checking and settings menu in the future
const exampleMenuTemplate = () => [
    {
      label: "Other",
      submenu: [
        {
          label: "Discord",
          click: function () { require('electron').shell.openExternal('https://discord.gg/kbf8EjpxbU'); }
        },
        {
          label: "Github",
          click: function () { require('electron').shell.openExternal('https://github.com/V0l-D/Discord-Netflix'); }
        },
        {
            label: "Dev console",
            role: "toggleDevTools"
          }
      ]
    }
  ];