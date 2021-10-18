const RPC = require('discord-rpc')
const util = require('util')
const sleep = util.promisify(setTimeout)

module.exports = class Client extends RPC.Client {
    constructor (options) {
        super(options)

        this.currentState = {}
        this.clientId = options.clientId
    }

    async start (tries = 0) {
        let { clientId } = this

        if (tries === 3)
            throw new Error('Too many tries')

        try {
            await this.login({ clientId })
        } catch (e) {
            await sleep(10E3)

            tries++

            return this.start(tries)
        }
    }
}
