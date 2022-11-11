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
const {
    ipcMain,
    nativeImage
} = require('electron')
const { Menu } = require('electron');
app.setAppUserModelId('com.netflix.V0l-D')

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

//small fix for linux peepz
//app.commandLine.appendSwitch('--no-sandbox')

rpc.on('ready', () => {
    mainWindow.checkNetflix()
    components.whenReady()
    setInterval(mainWindow.checkNetflix.bind(mainWindow), 15E3)
})

    //Attempt on auto updater
   /* const {autoUpdater} = require('electron-updater');
    const log = require('electron-log');
    log.transports.file.resolvePath = () => path.join(`C:\Users\top05\Desktop\Discord-Netflix-main\logs`, 'main.log');
    log.log("Application version = "+ app.getVersion())

    autoUpdater.on("update-available",(info)=>{
        log.info("update-available");
    })
    
    autoUpdater.on("checking-for-update",(info)=>{
        log.info("checking-for-update");
    })
    
    autoUpdater.on("download-progress",(info)=>{
        log.info("download-progress");
    })
    
    autoUpdater.on("update-downloaded",(info)=>{
        log.info("update-downloaded");
    })
    
    autoUpdater.on("update-not-available",(info)=>{
        log.info("update-not-available");
    })
    
    autoUpdater.on("error",(err)=>{
        log.info("Error while updating. " + err);
    })
    
    autoUpdater.on("download-progress",(progressTrack)=>{
        log.info("\n\ndownload-progress")
    log.info(progressTrack)
    })*/

app.on('ready', () => {
   // autoUpdater.checkForUpdatesAndNotify()
    mainWindow = new BrowserWindow({
        rpc,
        icon,
        party,
    })

    const {components} = require('electron');

app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  createWindow();
});

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
