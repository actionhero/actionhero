'use strict'

const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * This callback is displayed as part of the Requester class.
 * @callback ActionHero~ChatSayCallback
 * @param {Object} connection - The connection being created/destroyed.
 * @param {string} room - The room being chatted within.
 * @param {Object} messagePayload - The message & metadata.
 * @see ActionHero~ChatMiddleware
 */

/**
 * This callback is displayed as part of the Requester class.
 * @callback ActionHero~ChatRoomCallback
 * @param {Object} connection - The connection being created/destroyed.
 * @param {string} room - The room being chatted within.
 * @see ActionHero~ChatMiddleware
 */

/**
 * Middleware definition for processing chat events.  Can be of the
 *
 * @async
 * @typedef {Object} ActionHero~ChatMiddleware
 * @property {string} name - Unique name for the middleware.
 * @property {Number} priority - Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`.
 * @property {ActionHero~ChatRoomCallback} join - Called when a connection joins a room.
 * @property {ActionHero~ChatRoomCallback} leave - Called when a connection leaves a room.
 * @property {ActionHero~ChatSayCallback} onSayReceive - Called when a connection says a message to a room.
 * @property {ActionHero~ChatSayCallback} say - Called when a connection is about to recieve a say message.
 * @see api.chatRoom.addMiddleware
 * @see ActionHero~ChatRoomCallback
 * @see ActionHero~ChatSayCallback
 * @example
 var chatMiddleware = {
  name: 'chat middleware',
  priority: 1000,
  join: (connection, room) => {
    // announce all connections entering a room
    api.chatRoom.broadcast({}, room, 'I have joined the room: ' + connection.id, callback)
  },
  leave:(connection, room, callback) => {
    // announce all connections leaving a room
    api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, callback)
  },
  // Will be executed once per client connection before delivering the message.
  say: (connection, room, messagePayload) => {
    // do stuff
    api.log(messagePayload)
  },
  // Will be executed only once, when the message is sent to the server.
  onSayReceive: (connection, room, messagePayload) => {
    // do stuff
    api.log(messagePayload)
  }
}

api.chatRoom.addMiddleware(chatMiddleware)
 */

/**
 * Chat & Realtime Communication Methods
 *
 * @namespace api.chatRoom
 * @property {Object} middleware - Dictionary of loaded middleware modules.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 * @property {string} messageChannel - The redis pub/sub channel for chat communication.
 * @property {Object} keys - Stores the base keys for stats about the chat system (rooms & members).
 * @extends ActionHero.Initializer
 */
class ChatRoom extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'chatRoom'
    this.loadPriority = 520
    this.startPriority = 200
  }

  initialize () {
    if (api.config.redis.enabled === false) { return }

    api.chatRoom = {
      middleware: {},
      globalMiddleware: [],
      messageChannel: '/actionhero/chat/chat',
      keys: {
        rooms: 'actionhero:chatRoom:rooms',
        members: 'actionhero:chatRoom:members:'
      }
    }

    /**
     * Add a middleware component to connection handling.
     *
     * @param {object} data The middleware definition to add.
     * @see ActionHero~ChatMiddleware
     */
    api.chatRoom.addMiddleware = (data) => {
      if (!data.name) { throw new Error('middleware.name is required') }
      if (!data.priority) { data.priority = api.config.general.defaultMiddlewarePriority }
      data.priority = Number(data.priority)
      api.chatRoom.middleware[data.name] = data

      api.chatRoom.globalMiddleware.push(data.name)
      api.chatRoom.globalMiddleware.sort((a, b) => {
        if (api.chatRoom.middleware[a].priority > api.chatRoom.middleware[b].priority) {
          return 1
        } else {
          return -1
        }
      })
    }

    /**
     * Send a message to all members of a chat room.  This is used by the server.
     *
     * @async
     * @param  {Object}  connection The connection sending the message.  If the message is coming from the sever, a proxy like `{rooms ['thisRoom'], id: 0}` would work.
     * @param  {string}  room       The name of the room.
     * @param  {Object|Array|Stting}  message    The message
     * @return {Promise}
     */
    api.chatRoom.broadcast = async (connection, room, message) => {
      if (!room || room.length === 0 || message === null || message.length === 0) {
        return api.config.errors.connectionRoomAndMessage(connection)
      } else if (connection.rooms === undefined || connection.rooms.indexOf(room) > -1) {
        if (connection.id === undefined) { connection.id = 0 }
        const payload = {
          messageType: 'chat',
          serverToken: api.config.general.serverToken,
          serverId: api.id,
          message: message,
          sentAt: new Date().getTime(),
          connection: {
            id: connection.id,
            room: room
          }
        }

        const messagePayload = api.chatRoom.generateMessagePayload(payload)
        const newPayload = await api.chatRoom.runMiddleware(connection, messagePayload.room, 'onSayReceive', messagePayload)
        const payloadToSend = {
          messageType: 'chat',
          serverToken: api.config.general.serverToken,
          serverId: api.id,
          message: newPayload.message,
          sentAt: newPayload.sentAt,
          connection: {
            id: newPayload.from,
            room: newPayload.room
          }
        }

        await api.redis.publish(payloadToSend)
      } else {
        return api.config.errors.connectionNotInRoom(connection, room)
      }
    }

    /**
     * @private
     */
    api.chatRoom.generateMessagePayload = (message) => {
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: 'user',
        sentAt: message.sentAt
      }
    }

    /**
     * @private
     */
    api.chatRoom.incomingMessage = (message) => {
      const messagePayload = api.chatRoom.generateMessagePayload(message)
      Object.keys(api.connections.connections).forEach((connetionId) => {
        let connection = api.connections.connections[connetionId]
        // we can parallize this, no need to await
        api.chatRoom.incomingMessagePerConnection(connection, messagePayload)
      })
    }

    /**
     * @private
     */
    api.chatRoom.incomingMessagePerConnection = async (connection, messagePayload) => {
      if (connection.canChat === true && connection.rooms.indexOf(messagePayload.room) > -1) {
        try {
          const newMessagePayload = await api.chatRoom.runMiddleware(connection, messagePayload.room, 'say', messagePayload)
          if (!(newMessagePayload instanceof Error)) {
            connection.sendMessage(newMessagePayload, 'say')
          }
        } catch (error) {
          api.log(error, 'warning', {messagePayload, connection})
        }
      }
    }

    /**
     * List all chat rooms created
     *
     * @async
     * @return {Promise<Array>} Returns an array of chatRoom names.
     */
    api.chatRoom.list = async () => {
      return api.redis.clients.client.smembers(api.chatRoom.keys.rooms)
    }

    /**
     * Add a new chat room.  Throws an error if the room already exists.
     *
     * @async
     * @param  {string}  room The name of the room
     * @return {Promise}
     * @see api.chatRoom.destroy
     */
    api.chatRoom.add = async (room) => {
      let found = await api.chatRoom.exists(room)
      if (found === false) {
        return api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room)
      } else {
        throw new Error(await api.config.errors.connectionRoomExists(room))
      }
    }

    /**
     * Remove an exsitng chat room.  All connections in the room will be removed.  Throws an error if the room does not exist.
     *
     * @async
     * @param  {string}  room The name of the room
     * @return {Promise}
     * @see api.chatRoom.add
     */
    api.chatRoom.destroy = async (room) => {
      let found = await api.chatRoom.exists(room)
      if (found === true) {
        await api.chatRoom.broadcast({}, room, await api.config.errors.connectionRoomHasBeenDeleted(room))
        let membersHash = await api.redis.clients.client.hgetall(api.chatRoom.keys.members + room)

        for (let id in membersHash) {
          api.chatRoom.removeMember(id, room, false)
        }

        await api.redis.clients.client.srem(api.chatRoom.keys.rooms, room)
        await api.redis.clients.client.del(api.chatRoom.keys.members + room)
      } else {
        throw new Error(await api.config.errors.connectionRoomNotExist(room))
      }
    }

    /**
     * Check if a room exists.
     *
     * @async
     * @param  {string}  room The name of the room
     * @return {Promise<Boolean>}
     */
    api.chatRoom.exists = async (room) => {
      let bool = await api.redis.clients.client.sismember(api.chatRoom.keys.rooms, room)
      let found = false
      if (bool === 1 || bool === true) { found = true }
      return found
    }

    /**
     * An overwritable method which configures what properties of connections in a room to return via `api.chatRoom.roomStatus`
     *
     * @param  {Object} memberData A connection
     * @return {Object} sanitizedMemberDetails The resulting object
     * @see api.chatRoom.roomStatus
     */
    api.chatRoom.sanitizeMemberDetails = (memberData) => {
      return {
        id: memberData.id,
        joinedAt: memberData.joinedAt
      }
    }

    /**
     * Learn about the connections in the room
     *
     * @async
     * @param  {string}  room The name of the room
     * @return {Promise<Object>} Returns a hash of the form { room: room, members: cleanedMembers, membersCount: count }.  Members is an array of connections in the room sanitized via `api.chatRoom.sanitizeMemberDetails`
     */
    api.chatRoom.roomStatus = async (room) => {
      if (room) {
        let found = await api.chatRoom.exists(room)
        if (found === true) {
          const key = api.chatRoom.keys.members + room
          let members = await api.redis.clients.client.hgetall(key)
          let cleanedMembers = {}
          let count = 0

          for (let id in members) {
            const data = JSON.parse(members[id])
            cleanedMembers[id] = api.chatRoom.sanitizeMemberDetails(data)
            count++
          }

          return {
            room: room,
            members: cleanedMembers,
            membersCount: count
          }
        } else {
          throw new Error(await api.config.errors.connectionRoomNotExist(room))
        }
      } else {
        throw new Error(await api.config.errors.connectionRoomRequired())
      }
    }

    /**
     * An overwritable method which configures what properties of connections in a room are initially stored about a connection when added via `api.chatRoom.addMember`
     *
     * @param  {Object} connection A ActionHero.Connection
     * @return {Object} sanitizedConnection The resulting object
     * @see api.chatRoom.addMember
     */
    api.chatRoom.generateMemberDetails = (connection) => {
      return {
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: api.id
      }
    }

    /**
     * Add a connection (via id) to a rooom.  Throws errors if the room does not exist, or the connection is already in the room.  Middleware errors also throw.
     *
     * @async
     * @param  {string}  connectionId An existing connection's ID
     * @param  {srting}  room         The name of the room.
     * @return {Promise<Boolean>}
     * @see api.chatRoom.removeMember
     */
    api.chatRoom.addMember = async (connectionId, room) => {
      let connection = api.connections.connections[connectionId]
      if (!connection) {
        return api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, true)
      }

      if (connection.rooms.indexOf(room) >= 0) {
        throw new Error(await api.config.errors.connectionAlreadyInRoom(connection, room))
      }

      if (connection.rooms.indexOf(room) < 0) {
        let found = await api.chatRoom.exists(room)
        if (!found) {
          throw new Error(await api.config.errors.connectionRoomNotExist(room))
        }
      }

      if (connection.rooms.indexOf(room) < 0) {
        let response = await api.chatRoom.runMiddleware(connection, room, 'join')
        if (response instanceof Error) { throw response }
      }

      if (connection.rooms.indexOf(room) < 0) {
        let memberDetails = api.chatRoom.generateMemberDetails(connection)
        connection.rooms.push(room)
        await api.redis.clients.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails))
      }

      return true
    }

    /**
     * Remote a connection (via id) from a rooom.  Throws errors if the room does not exist, or the connection is not in the room.  Middleware errors also throw.
     *
     * @async
     * @param  {string}  connectionId  An existing connection's ID
     * @param  {srting}  room          The name of the room.
     * @param  {Boolean}  toWaitRemote Should this method wait until the remote ActionHero server (the one the connection is connected too) responds?
     * @return {Promise<Boolean>}
     * @see api.chatRoom.addMember
     */
    api.chatRoom.removeMember = async (connectionId, room, toWaitRemote) => {
      if (toWaitRemote === undefined || toWaitRemote === null) { toWaitRemote = true }
      let connection = api.connections.connections[connectionId]
      if (!connection) {
        return api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, toWaitRemote)
      }

      if (connection.rooms.indexOf(room) < 0) {
        throw new Error(await api.config.errors.connectionNotInRoom(connection, room))
      }

      if (connection.rooms.indexOf(room) >= 0) {
        let found = await api.chatRoom.exists(room)
        if (!found) {
          throw new Error(await api.config.errors.connectionRoomNotExist(room))
        }
      }

      if (connection.rooms.indexOf(room) >= 0) {
        let response = await api.chatRoom.runMiddleware(connection, room, 'leave')
        if (response instanceof Error) { throw response }
      }

      if (connection.rooms.indexOf(room) >= 0) {
        let index = connection.rooms.indexOf(room)
        connection.rooms.splice(index, 1)
        await api.redis.clients.client.hdel(api.chatRoom.keys.members + room, connection.id)
      }

      return true
    }

    /**
     * @private
     */
    api.chatRoom.runMiddleware = async (connection, room, direction, messagePayload) => {
      let newMessagePayload
      let toReturn = true
      if (messagePayload) { newMessagePayload = Object.assign({}, messagePayload) }

      api.chatRoom.globalMiddleware.forEach(async (name) => {
        const m = api.chatRoom.middleware[name]
        try {
          if (typeof m[direction] === 'function') {
            if (messagePayload) {
              let data = await m[direction](connection, room, newMessagePayload)
              if (data) { newMessagePayload = data }
            } else {
              await m[direction](connection, room)
            }
          }
        } catch (error) {
          toReturn = error
        }
      })

      if (toReturn !== true) { return toReturn }
      return newMessagePayload
    }
  }

  async start () {
    if (api.config.redis.enabled === false) { return }

    api.redis.subscriptionHandlers.chat = (message) => {
      if (api.chatRoom) { api.chatRoom.incomingMessage(message) }
    }

    if (api.config.general.startingChatRooms) {
      Object.keys(api.config.general.startingChatRooms).forEach(async (room) => {
        api.log(`ensuring the existence of the chatRoom: ${room}`)
        try {
          await api.chatRoom.add(room)
        } catch (error) {
          if (!error.toString().match(await api.config.errors.connectionRoomExists(room))) { throw error }
        }
      })
    }
  }
}

module.exports = ChatRoom
