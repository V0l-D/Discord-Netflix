const Electron = require('electron')
const scripts = require('../util/scripts')
const moment = require('moment')
const crypto = require('crypto')
const path = require('path')

module.exports = class BrowserWindow extends Electron.BrowserWindow {
    constructor({
        title,
        icon,
        rpc,
        party
    }) {
        super({
            backgroundColor: '#141414', //Let's not blind ourselfs here
            useContentSize: false,
            autoHideMenuBar: true,
            resizable: true,
            center: true,
            fullscreenable: true,
            alwaysOnTop: false,
            title,
            icon,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false, // add this
                plugins: true,
                preload: path.join(__dirname, '../util/scripts/np_content_script.js'), 
            } //Fast fix oops
        })
        this.rpc = rpc
        this.party = party
        this.partyState = null
    }

    eval(code) {
        return this.webContents.executeJavaScript(code)
    }

    getInfos() {
        return this.eval(`(${scripts.infos})()`)
    }

    async checkNetflix() {
        let infos = await this.getInfos()

        if (infos) { // if !infos don't change presence then.
            let {
                name,
                title,
                episode,
                duration,
                currentTime,
                paused,
                interactive,
                avatar,
                userName,
                button
            } = infos
            let video = episode && title ?
                `${episode} - ${title}` :
                episode
            let endTimestamp
            let smallImageKey
            let smallImageText
                // Evaluate the avatar id from the avatar (RegExp was acting funny inside the executeJavaScript for some reason, same code worked if copy and pasted into inspect element console and here)
            let avatarRegex = /AVATAR\|(.*)\|.*\|.*\|.*/gm
            let match = avatarRegex.exec(avatar)

            if (match)
                avatar = crypto
                .createHash('md5')
                .update(match[1])
                .digest('hex')

            // if the avatar doesn't show in the Rich Presence, it means it's not supported
            if (avatar)
                smallImageKey = crypto.createHash('md5').update(avatar).digest('hex'); //bad fix but who actually cares
            console.log(smallImageKey)

            if (userName)
                smallImageText = userName


            if (duration && currentTime && !paused && !interactive) {
                let now = moment.utc()
                let remaining = moment.duration(duration - currentTime, 'seconds')

                endTimestamp = now.add(remaining).unix()
            }

            this.rpc.currentState = {
                avatar,
                video,
                paused
            }

            var activity = {
                details: name,
                state: video,
                largeImageKey: 'netflix',
                largeImageText: 'Netflix',
                smallImageKey,
                smallImageText,
                instance: false,
                endTimestamp,
                buttons: button
            }

            // Currently disabled (not programmed)
            this.partyState = this.party.sessionData
            if (this.party.sessionData.id !== null) {
                var videoIdMatch = this.getURL().match(/^.*\/([0-9]+)\??.*/)
                if (videoIdMatch) {
                    var videoId = parseInt(videoIdMatch[1])
                    activity.partyId = this.party.sessionData.id
                    activity.partySize = this.party.sessionData.partyCount
                    activity.partyMax = this.party.sessionData.partyCount + 1
                    activity.joinSecret = Buffer.from(videoId + ',' + this.party.sessionData.id).toString('base64')
                    activity.instance = true
                }
            }

            this.rpc.setWatchingActivity({
    name,
    video,
    avatar,
    userName,
    paused,
    endTimestamp,
    button
});
        }
    }
    

}