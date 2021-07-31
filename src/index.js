const { app, BrowserWindow, Notification } = require('./Electron')
const { Client } = require('./RPC')
const { NetflixParty } = require('./NetflixParty')
const path = require('path')
const discordRegister = require('electron-discord-register')
const { ipcMain } = require('electron')
require('update-electron-app')()
const globToRegExp = require('glob-to-regexp');

app.setAppUserModelId('com.netflix.Terroriser1')

const icon = path.join(__dirname, '../assets/icon.png')
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

    setInterval(mainWindow.checkNetflix.bind(mainWindow), 15E3)
})

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        rpc,
        title: 'Netflix',
        icon,
        party,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Edg/92.0.902.55",//Privacy
    })
    mainWindow.maximize()
    mainWindow.loadURL('https://www.netflix.com/browse') 

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
