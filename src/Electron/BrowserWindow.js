const { BrowserWindow: ElectronBrowserWindow } = require('electron');
const scripts = require('../util/scripts');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch').default;
const { dialog, shell, app } = require('electron');

function normalizeTime(time) {
  if (!time || isNaN(time)) return 0;
  return time > 100_000 ? time / 1000 : time;
}

function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

function normalizeVersion(v) {
  return v.replace(/^v/, '');
}

function isNewerVersion(latest, current) {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  return l.some((n, i) => n > (c[i] || 0));
}

module.exports = class BrowserWindow extends ElectronBrowserWindow {
  constructor({ title, icon, rpc }) {
    super({
      backgroundColor: '#141414',
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
    this._checkedForUpdates = false;

    // Run update check AFTER first load
    this.webContents.once('did-finish-load', () => {
      setTimeout(() => this.checkForUpdates(), 4000);
    });
  }

    async checkForUpdates() {
    if (this._checkedForUpdates) return;
    this._checkedForUpdates = true;

    try {
      const res = await fetch(
        'https://api.github.com/repos/Discord-Netflix/Discord-Netflix/releases/latest',
        { headers: { 'User-Agent': 'Discord-Netflix' } }
      );

      if (!res.ok) return;

      const release = await res.json();
      const latest = normalizeVersion(release.tag_name);
      const current = app.getVersion();

      if (!isNewerVersion(latest, current)) return;

      const result = await dialog.showMessageBox(this, {
        type: 'info',
        title: 'Update available',
        message: 'A new version of Discord-Netflix is available.',
        detail:
          `Current: v${current}\n` +
          `New: v${latest}\n\n` +
          (release.body || ''),
        buttons: ['Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        shell.openExternal(release.html_url);
        app.quit();
      }
    } catch (err) {
      console.error('[update] failed:', err);
    }
  }

  // Wrapper for webContents.executeJavaScript
  eval(code) {
    return this.webContents.executeJavaScript(code);
  }

  // Get Netflix page info via injected script
  getInfos() {
    return this.eval(`(${scripts.infos})()`);
  }

  // Main Netflix check
  async checkNetflix() {
    try {
      const infos = await this.getInfos();
      if (!infos) return;

      const now = Date.now();
      let elapsedMs = 0;
      let startTimestamp;
      let endTimestamp;

      const isBrowsing = infos.name === 'Browsing';
      const isPaused = infos.paused;

      // Browsing logic
      if (isBrowsing) {
        this.browsingStart ||= now; // initialize if null
        elapsedMs = now - this.browsingStart;

        if (!isPaused) startTimestamp = new Date(this.browsingStart);
      } 
      // Watching a video
      else if (infos.duration && infos.currentTime) {
        this.browsingStart = null;

        const currentTimeSec = normalizeTime(infos.currentTime);
        const durationSec = normalizeTime(infos.duration);

        elapsedMs = currentTimeSec * 1000;

        if (!isPaused) {
          startTimestamp = new Date(now - elapsedMs);
          endTimestamp = new Date(startTimestamp.getTime() + durationSec * 1000);
        }
      } 
      // Neither browsing nor watching
      else {
        this.browsingStart = null;
      }

      // Send activity to Discord RPC
      await this.rpc.setWatchingActivity({
        title: infos.title || 'Watching Netflix',
        state: infos.state || '',
        avatar: infos.avatar ? md5(infos.avatar) : '',
        userName: infos.userName || '',
        paused: !!isPaused,
        elapsedMs,
        durationMs: isBrowsing ? undefined : (infos.duration ? normalizeTime(infos.duration) * 1000 : undefined),
        ...(isPaused ? {} : { startTimestamp, endTimestamp }),
        buttons: infos.buttons?.length ? infos.buttons : undefined,
      });

      // Debug logs
      console.log('[checkNetflix] title:', infos.title);
      console.log('[checkNetflix] state:', infos.state);
      console.log('[checkNetflix] elapsedMs:', elapsedMs, 'startTimestamp:', startTimestamp, 'endTimestamp:', endTimestamp);

    } catch (err) {
      console.error('[checkNetflix] error:', err);
    }
  }
};
