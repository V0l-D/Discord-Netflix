const { Client } = require('@xhayper/discord-rpc');
const util = require('util');
const sleep = util.promisify(setTimeout);
const { ActivityType } = require('discord-api-types/v10');

module.exports = class RPCClient extends Client {
  constructor({ clientId }) {
    super({ clientId, transport: 'ipc' });

    this.clientId = clientId;
    this.currentState = null;
    this.ready = false;

    this.on('connected', () => console.log('[RPC] Connected to Discord'));
    this.on('ready', () => {
      console.log('[RPC] RPC Ready');
      this.ready = true;
    });
    this.on('disconnected', () => {
      console.log('[RPC] Disconnected from Discord');
      this.ready = false;
    });
  }

  /**
   * Attempts to start the RPC connection, retrying up to 3 times.
   */
  async start(tries = 0) {
    if (tries >= 3) throw new Error('Too many tries to connect to Discord');

    try {
      await this.login();
    } catch (error) {
      console.error(`[RPC] Login failed (attempt ${tries + 1}):`, error.message);
      await sleep(10000);
      return this.start(tries + 1);
    }
  }

  /**
   * Sets the Discord Rich Presence activity to "Watching".
   * Handles paused state and media duration timestamps.
   */
  async setWatchingActivity({
    title,
    state,
    avatar,
    userName,
    paused,
    elapsedMs,
    durationMs,
    buttons,
  }) {
    if (!this.ready || !this.user) {
      console.warn('[RPC] Cannot set activity: not ready or user unavailable');
      return;
    }

    const now = Date.now();

    const activity = {
      type: ActivityType.Watching,
      details: title || 'Watching Netflix',
      state: paused
        ? `Paused${state ? ` • ${state}` : ''}`
        : state || '',
      largeImageKey: 'netflix',
      largeImageText: `${title || 'Netflix'} on Netflix`,
      smallImageKey: avatar || undefined,
      smallImageText: userName || undefined,
      instance: false,
      buttons: buttons?.length ? buttons : undefined,
    };

    if (!paused && typeof elapsedMs === 'number') {
      const start = now - elapsedMs;
      activity.startTimestamp = new Date(start);

      if (typeof durationMs === 'number') {
        activity.endTimestamp = new Date(start + durationMs);
      }
    }

    this.currentState = activity;

    try {
      await this.user.setActivity(activity);
    } catch (err) {
      console.error('[RPC] Failed to set activity:', err);
    }
  }
};
