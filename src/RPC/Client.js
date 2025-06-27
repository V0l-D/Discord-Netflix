const { Client} = require('@xhayper/discord-rpc');
const util = require('util');
const sleep = util.promisify(setTimeout);
const { ActivityType } = require('discord-api-types/v10');

module.exports = class RPCClient extends Client {
    constructor({ clientId }) {
        super({ clientId, transport: 'ipc' });

        this.clientId = clientId;
        this.currentState = null;
        this.ready = false;
    }

    async start(tries = 0) {
        if (tries >= 3) throw new Error('Too many tries to connect to Discord');

        try {
            await this.login();
            this.ready = true;
        } catch (error) {
            console.error(`[Discord RPC] Login failed (try ${tries + 1}):`, error.message);
            await sleep(10000);
            return this.start(tries + 1);
        }
        // After super() in constructor:
this.on('connected', () => console.log('[RPC] ► Connected to Discord'));
this.on('ready', () => console.log('[RPC] ► RPC Ready'));
this.on('disconnected', () => console.log('[RPC] ► Disconnected'));

// In setWatchingActivity():
console.log('[RPC] ► setWatchingActivity called:', { details: activity.details, state: activity.state });

    }

    setWatchingActivity({ name, video, avatar, userName, paused, endTimestamp, button }) {
  const activity = {
    type: ActivityType.Watching,
    details: 'Watching',
    state: video || name || 'Netflix',
    largeImageKey: 'netflix',
    largeImageText: name ? `${name} on Netflix` : 'Netflix',
    smallImageKey: avatar || undefined,
    smallImageText: userName || undefined,
    endTimestamp: !paused ? endTimestamp : undefined,
    buttons: button || undefined,
    instance: false
  };

  if (this.user) {
    console.log('[RPC] Setting activity:', activity);
    this.user.setActivity(activity).catch(console.error);
  } else {
    console.warn('[RPC] Tried to set activity before user was ready.');
  }
}
}