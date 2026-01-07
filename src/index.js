const { app, BrowserWindow, Notification } = require('./Electron')
const { Client } = require('./RPC')
const path = require('path')
const { components } = require('electron')

app.setAppUserModelId('DiscordNetflix')

const icon = path.join(__dirname, '../assets/icon.png')

const clientId = '868487355114323968'

let mainWindow
const rpc = new Client({ transport: 'ipc', clientId })

//|| Fix for Linux systems ||\\
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
}

rpc.on('ready', () => {
    mainWindow.checkNetflix()
    setInterval(mainWindow.checkNetflix.bind(mainWindow), 15E3)
})

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        rpc,
        icon
    })

    app.whenReady().then(() => {
            app.emit('rpc')
      })

    mainWindow.maximize()
    mainWindow.loadURL('https://netflix.com/browse');
})

app.whenReady();

app.on('window-all-closed', () => {
    app.quit()
})

app.on('rpc', () => {
    rpc.start().then(() => {
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