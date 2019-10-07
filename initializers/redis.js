'use strict'

const uuid = require('uuid')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Redis helpers and connections.
 *
 * @namespace api.redis
 * @property {Object} clients - Holds the redis clients.  Contains 3 redis connections: 'client', 'subscriber' and 'tasks'.  Configured via `api.config.redis`.
 * @property {Object} clients.client - The main redis connection.  Use this if you need direct access to redis.
 * @property {Object} clients.subscriber - A Redis connection only listeneing for reids pub/sub events.
 * @property {Object} clients.tasks - A Redis connection for use only in the task ssytem.
 * @property {Object} subscriptionHandlers - Callbacks for redis pub/sub
 * @property {Object} rpcCallbacks - RPC callbacks for responses to other clients
 * @property {Object} status - Redis connection statuses
 * @extends ActionHero.Initializer
 */
module.exports = class Redis extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'redis'
    this.loadPriority = 200
    this.startPriority = 101
    this.stopPriority = 99999
  }

  async initialize () {
    if (api.config.redis.enabled === false) { return }

    api.redis = {}
    api.redis.clients = {}
    api.redis.subscriptionHandlers = {}
    api.redis.rpcCallbacks = {}
    api.redis.status = {
      subscribed: false
    }

    /**
     * Publish a message to all other ActionHero nodes in the clsuter.  Will be autneticated against `api.config.serverToken`
     *
     * @async
     * @param  {Object}  payload The message to send.  Must include `serverToken`
     * @return {Promise}
     * @example
let payload = {
  messageType: 'myMessageType',
  serverId: api.id,
  serverToken: api.config.general.serverToken,
  message: 'hello!'
}

await api.redis.publish(payload)
     */
    api.redis.publish = async (payload) => {
      const channel = api.config.general.channel
      return api.redis.clients.client.publish(channel, JSON.stringify(payload))
    }

    api.redis.subscriptionHandlers.do = async (message) => {
      if (!message.connectionId || (api.connections && api.connections.connections[message.connectionId])) {
        const cmdParts = message.method.split('.')
        const cmd = cmdParts.shift()
        if (cmd !== 'api') { throw new Error('cannot operate on a method outside of the api object') }
        const method = api.utils.dotProp.get(api, cmdParts.join('.'))
        let args = message.args
        if (args === null) { args = [] }
        if (!Array.isArray(args)) { args = [args] }
        if (method) {
          const response = await method.apply(null, args)
          await api.redis.respondCluster(message.messageId, response)
        } else {
          api.log('RPC method `' + cmdParts.join('.') + '` not found', 'warning')
        }
      }
    }

    api.redis.subscriptionHandlers.doResponse = function (message) {
      if (api.redis.rpcCallbacks[message.messageId]) {
        const { resolve, timer } = api.redis.rpcCallbacks[message.messageId]
        clearTimeout(timer)
        resolve(message.response)
        delete api.redis.rpcCallbacks[message.messageId]
      }
    }

    /**
     * Invoke a command on all servers in this cluster.
     *
     * @async
     * @param  {string}  method         The method to call on the remote server.
     * @param  {Array}   args           The arguments to pass to `method`
     * @param  {string}  connectionId   (optional) Should this method only apply to a server which `connectionId` is connected to?
     * @param  {Boolean}  waitForResponse (optional) Should we await a response from a remote server in the cluster?
     * @return {Promise}                The return value from the remote server.
     */
    api.redis.doCluster = async (method, args, connectionId, waitForResponse) => {
      if (waitForResponse === undefined || waitForResponse === null) { waitForResponse = false }
      const messageId = uuid.v4()
      const payload = {
        messageType: 'do',
        serverId: api.id,
        serverToken: api.config.general.serverToken,
        messageId: messageId,
        method: method,
        connectionId: connectionId,
        args: args // [1,2,3]
      }

      // we need to be sure that we build the response-handling promise before sending the request to Redis
      // it is possible for another node to get and work the request before we resolve our write
      // see https://github.com/actionhero/actionhero/issues/1244 for more information
      if (waitForResponse) {
        return new Promise(async (resolve, reject) => { //eslint-disable-line
          const timer = setTimeout(() => reject(new Error('RPC Timeout')), api.config.general.rpcTimeout)
          api.redis.rpcCallbacks[messageId] = { timer, resolve, reject }
          try {
            await api.redis.publish(payload)
          } catch (e) {
            clearTimeout(timer)
            delete api.redis.rpcCallbacks[messageId]
            throw e
          }
        })
      }

      await api.redis.publish(payload)
    }

    api.redis.respondCluster = async (messageId, response) => {
      const payload = {
        messageType: 'doResponse',
        serverId: api.id,
        serverToken: api.config.general.serverToken,
        messageId: messageId,
        response: response // args to pass back, including error
      }

      await api.redis.publish(payload)
    }

    const connectionNames = ['client', 'subscriber', 'tasks']
    for (var i in connectionNames) {
      const r = connectionNames[i]
      if (api.config.redis[r].buildNew === true) {
        const args = api.config.redis[r].args
        api.redis.clients[r] = new api.config.redis[r].konstructor(args[0], args[1], args[2]) // eslint-disable-line
        api.redis.clients[r].on('error', (error) => { api.log(`Redis connection \`${r}\` error`, 'alert', error) })
        api.redis.clients[r].on('connect', () => { api.log(`Redis connection \`${r}\` connected`, 'debug') })
      } else {
        api.redis.clients[r] = api.config.redis[r].konstructor.apply(null, api.config.redis[r].args)
        api.redis.clients[r].on('error', (error) => { api.log(`Redis connection \`${r}\` error`, 'alert', error) })
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

  async start () {
    if (api.config.redis.enabled === false) {
      api.log('redis is disabled', 'notice')
    } else {
      await api.redis.doCluster('api.log', [`actionhero member ${api.id} has joined the cluster`])
    }
  }

  async stop () {
    if (api.config.redis.enabled === false) { return }

    await api.redis.clients.subscriber.unsubscribe()
    api.redis.status.subscribed = false
    await api.redis.doCluster('api.log', [`actionhero member ${api.id} has left the cluster`])

    const keys = Object.keys(api.redis.clients)
    for (const i in keys) {
      const client = api.redis.clients[keys[i]]
      if (typeof client.quit === 'function') {
        await client.quit()
      } else if (typeof client.end === 'function') {
        await client.end()
      } else if (typeof client.disconnect === 'function') {
        await client.disconnect()
      }
    }
  }
}
