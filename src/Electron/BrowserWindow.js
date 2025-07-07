const Electron = require('electron');
const scripts = require('../util/scripts');
const path = require('path');
const crypto = require('crypto');

function normalizeTime(time) {
  if (time === undefined || time === null || isNaN(time)) return 0;
  return time > 100000 ? time / 1000 : time;
}

function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

module.exports = class BrowserWindow extends Electron.BrowserWindow {
  constructor({ title, icon, rpc }) {
    super({
      backgroundColor: '#141414',
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
        sandbox: false,
        plugins: true,
        preload: path.join(__dirname, '../util/scripts/content_script.js'),
      },
    });

    this.rpc = rpc;
    this.browsingStart = null;
  }

  eval(code) {
    return this.webContents.executeJavaScript(code);
  }

  getInfos() {
    return this.eval(`(${scripts.infos})()`);
  }

async checkNetflix() {
  try {
    const infos = await this.getInfos();
    if (!infos) return;

    console.log('Buttons payload:', infos.buttons);

    const now = Date.now();
    let elapsedMs = 0;
    let startTimestamp;
    let endTimestamp;

    const isBrowsing = infos.name === 'Browsing';
    const isPaused = infos.paused;

    if (isBrowsing) {
      if (!this.browsingStart) this.browsingStart = now;
      elapsedMs = now - this.browsingStart;

      if (!isPaused) {
        startTimestamp = new Date(this.browsingStart);
      }
    } else if (infos.duration && infos.currentTime) {
      this.browsingStart = null;

      const currentTimeSec = normalizeTime(infos.currentTime);
      const durationSec = normalizeTime(infos.duration);

      elapsedMs = currentTimeSec * 1000;

      if (!isPaused) {
        startTimestamp = new Date(now - elapsedMs);
        endTimestamp = new Date(startTimestamp.getTime() + durationSec * 1000);
      }
    } else {
      this.browsingStart = null;
    }

    console.log('[RPC] Sending elapsedMs:', elapsedMs);
    if (startTimestamp) console.log('[RPC] startTimestamp:', startTimestamp);
    if (endTimestamp) console.log('[RPC] endTimestamp:', endTimestamp);

    await this.rpc.setWatchingActivity({
      title: infos.title || 'Watching Netflix',
      state: infos.state || '',
      avatar: infos.avatar ? md5(infos.avatar) : '',
      userName: infos.userName || '',
      paused: isPaused || false,
       elapsedMs,
  durationMs: isBrowsing ? undefined : (infos.duration ? normalizeTime(infos.duration) * 1000 : undefined),
      // Only include timestamps if not paused
      ...(isPaused ? {} : {
        startTimestamp,
        endTimestamp,
      }),
      buttons: infos.buttons?.length ? infos.buttons : undefined,
    });

    console.log('[checkNetflix] Sending title:', infos.title);
    console.log('[checkNetflix] Sending state:', infos.state);

  } catch (err) {
    console.error('[checkNetflix] error:', err);
  }
}
}