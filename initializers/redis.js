'use strict'

const uuid = require('uuid')
const ActionHero = require('./../index.js')

module.exports = class Redis extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'redis'
    this.loadPriority = 200
    this.startPriority = 101
    this.stopPriority = 99999
  }

  async initialize (api) {
    if (api.config.redis.enabled === false) { return }

    api.redis = {}
    api.redis.clients = {}
    api.redis.subscriptionHandlers = {}
    api.redis.rpcCallbacks = {}
    api.redis.status = {
      subscribed: false
    }

    api.redis.publish = async (payload) => {
      const channel = api.config.general.channel
      return api.redis.clients.client.publish(channel, JSON.stringify(payload))
    }

    api.redis.subscriptionHandlers['do'] = async (message) => {
      if (!message.connectionId || (api.connections && api.connections.connections[message.connectionId])) {
        let cmdParts = message.method.split('.')
        let cmd = cmdParts.shift()
        if (cmd !== 'api') { throw new Error('cannot operate on a method outside of the api object') }
        let method = api.utils.dotProp.get(api, cmdParts.join('.'))
        let args = message.args
        if (args === null) { args = [] }
        if (!Array.isArray(args)) { args = [args] }
        if (method) {
          let response = await method.apply(null, args)
          await api.redis.respondCluster(message.requestId, response)
        } else {
          api.log('RPC method `' + cmdParts.join('.') + '` not found', 'warning')
        }
      }
    }

    api.redis.subscriptionHandlers.doResponse = function (message) {
      if (api.redis.rpcCallbacks[message.requestId]) {
        let {resolve, timer} = api.redis.rpcCallbacks[message.requestId]
        clearTimeout(timer)
        resolve(message.response)
        delete api.redis.rpcCallbacks[message.requestId]
      }
    }

    api.redis.doCluster = async (method, args, connectionId, waitForRespons) => {
      if (waitForRespons === undefined || waitForRespons === null) { waitForRespons = false }
      const requestId = uuid.v4()
      const payload = {
        messageType: 'do',
        serverId: api.id,
        serverToken: api.config.general.serverToken,
        requestId: requestId,
        method: method,
        connectionId: connectionId,
        args: args   // [1,2,3]
      }

      await api.redis.publish(payload)

      if (waitForRespons) {
        let response = await new Promise((resolve, reject) => {
          let timer = setTimeout(() => reject(new Error('RPC Timeout')), api.config.general.rpcTimeout)
          api.redis.rpcCallbacks[requestId] = {timer, resolve, reject}
        })

        return response
      }
    }

    api.redis.respondCluster = async (requestId, response) => {
      const payload = {
        messageType: 'doResponse',
        serverId: api.id,
        serverToken: api.config.general.serverToken,
        requestId: requestId,
        response: response // args to pass back, including error
      }

      await api.redis.publish(payload)
    }

    const connectionNames = ['client', 'subscriber', 'tasks']
    for (var i in connectionNames) {
      let r = connectionNames[i]
      if (api.config.redis[r].buildNew === true) {
        const args = api.config.redis[r].args
        api.redis.clients[r] = new api.config.redis[r].konstructor(args[0], args[1], args[2]) // eslint-disable-line
        api.redis.clients[r].on('error', (error) => { api.log(`Redis connection \`${r}\` error`, 'error', error) })
        api.redis.clients[r].on('connect', () => { api.log(`Redis connection \`${r}\` connected`, 'debug') })
      } else {
        api.redis.clients[r] = api.config.redis[r].konstructor.apply(null, api.config.redis[r].args)
        api.redis.clients[r].on('error', (error) => { api.log(`Redis connection \`${r}\` error`, 'error', error) })
        api.log(`Redis connection \`${r}\` connected`, 'debug')
      }

      await api.redis.clients[r].get('_test')
    }

    if (!api.redis.status.subscribed) {
      await api.redis.clients.subscriber.subscribe(api.config.general.channel)
      api.redis.status.subscribed = true

      const messageHandler = async (messageChannel, message) => {
        try { message = JSON.parse(message) } catch (e) { message = {} }
        if (messageChannel === api.config.general.channel && message.serverToken === api.config.general.serverToken) {
          if (api.redis.subscriptionHandlers[message.messageType]) {
            await api.redis.subscriptionHandlers[message.messageType](message)
          }
        }
      }

      api.redis.clients.subscriber.on('message', messageHandler)
    }
  }

  async start (api) {
    if (api.config.redis.enabled === false) {
      api.log('redis is disabled', 'notice')
    } else {
      await api.redis.doCluster('api.log', [`actionhero member ${api.id} has joined the cluster`])
    }
  }

  async stop (api) {
    if (api.config.redis.enabled === false) { return }

    api.redis.doCluster('api.log', [`actionhero member ${api.id} has left the cluster`])

    await api.redis.clients.subscriber.unsubscribe()
    api.redis.status.subscribed = false;

    ['client', 'subscriber', 'tasks'].forEach((r) => {
      let client = api.redis.clients[r]
      if (typeof client.quit === 'function') {
        client.quit()
      } else if (typeof client.end === 'function') {
        client.end()
      } else if (typeof client.disconnect === 'function') {
        client.disconnect()
      }
    })
  }
}
