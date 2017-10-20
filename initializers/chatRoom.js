'use strict'

const async = require('async')

/**
 * Chat & Realtime Communication Methods
 *
 * @namespace api.chatRoom
 * @property {Object} middleware - Dictionary of loaded middleware modules.
 * @property {Array} globalMiddleware - Array of global middleware modules.
 * @property {string} messageChannel - The redis pub/sub channel for chat communication.
 * @property {Object} keys - Stores the base keys for stats about the chat system (rooms & members).
 */

module.exports = {
  startPriority: 200,
  loadPriority: 520,
  initialize: function (api, next) {
    api.chatRoom = {}
    api.chatRoom.keys = {
      rooms: 'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:'
    }
    api.chatRoom.messageChannel = '/actionhero/chat/chat'

    api.chatRoom.middleware = {}
    api.chatRoom.globalMiddleware = []

    /**
     * Add a middleware component to connection handling.
     *
     * @param {object} data The middleware definition to add.
     */
    api.chatRoom.addMiddleware = function (data) {
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
     * @param  {Object}  connection The connection sending the message.  If the message is coming from the sever, a proxy like `{rooms ['thisRoom'], id: 0}` would work.
     * @param  {string}  room       The name of the room.
     * @param  {Object|Array|Stting}  message    The message
     * @param  {simpleCallback}  callback The callback that handles the response.
     */
    api.chatRoom.broadcast = function (connection, room, message, callback) {
      if (!room || room.length === 0 || message === null || message.length === 0) {
        if (typeof callback === 'function') { process.nextTick(() => { callback(api.config.errors.connectionRoomAndMessage(connection)) }) }
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

        api.chatRoom.handleCallbacks(connection, messagePayload.room, 'onSayReceive', messagePayload, (error, newPayload) => {
          if (error) {
            if (typeof callback === 'function') { process.nextTick(() => { callback(error) }) }
          } else {
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
            api.redis.publish(payloadToSend)
            if (typeof callback === 'function') { process.nextTick(() => { callback(null) }) }
          }
        })
      } else {
        if (typeof callback === 'function') { process.nextTick(() => { callback(api.config.errors.connectionNotInRoom(connection, room)) }) }
      }
    }

    /**
     * @private
     */
    api.chatRoom.generateMessagePayload = function (message) {
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
    api.chatRoom.incomingMessage = function (message) {
      const messagePayload = api.chatRoom.generateMessagePayload(message)
      for (let i in api.connections.connections) {
        api.chatRoom.incomingMessagePerConnection(api.connections.connections[i], messagePayload)
      }
    }

    /**
     * @private
     */
    api.chatRoom.incomingMessagePerConnection = function (connection, messagePayload) {
      if (connection.canChat === true) {
        if (connection.rooms.indexOf(messagePayload.room) > -1) {
          api.chatRoom.handleCallbacks(connection, messagePayload.room, 'say', messagePayload, (error, newMessagePayload) => {
            if (!error) { connection.sendMessage(newMessagePayload, 'say') }
          })
        }
      }
    }

    /**
     * List all chat rooms created
     *
     * @param {roomsCallback} callback The callback that handles the response.
     */
    api.chatRoom.list = function (callback) {
      api.redis.clients.client.smembers(api.chatRoom.keys.rooms, (error, rooms) => {
        if (typeof callback === 'function') { callback(error, rooms) }
      })
    }

    /**
     * This callback is invoked with an error or an array of chatRoom names.
     * @callback roomsCallback
     * @param {Error} error An error or null.
     * @param {Array<string>} rooms An array of chatRoom names.
     */

    /**
     * Add a new chat room.  Throws an error if the room already exists.
     *
     * @param  {string}  room The name of the room
     * @param {numberCallback} callback The callback that handles the response.
     * @see api.chatRoom.destroy
     */
    api.chatRoom.add = function (room, callback) {
      api.chatRoom.exists(room, function (error, found) {
        if (error) { return callback(error) }
        if (found === false) {
          api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room, (error, count) => {
            if (typeof callback === 'function') { callback(error, count) }
          })
        } else {
          if (typeof callback === 'function') { callback(api.config.errors.connectionRoomExists(room), null) }
        }
      })
    }

    /**
     * This callback is invoked with an error or a number.
     * @callback numberCallback
     * @param {Error} error An error or null.
     * @param {number} number A number.
     */

    /**
     * Remove an exsitng chat room.  All connections in the room will be removed.  Throws an error if the room does not exist.
     *
     * @param  {string}  room The name of the room
     * @param {simpleCallback} callback The callback that handles the response.
     * @see api.chatRoom.add
     */
    api.chatRoom.destroy = function (room, callback) {
      api.chatRoom.exists(room, (error, found) => {
        if (error) { return callback(error) }
        if (found === true) {
          api.chatRoom.broadcast({}, room, api.config.errors.connectionRoomHasBeenDeleted(room), () => {
            api.redis.clients.client.hgetall(api.chatRoom.keys.members + room, (error, membersHash) => {
              if (error) { return callback(error) }

              for (let id in membersHash) {
                api.chatRoom.removeMember(id, room)
              }

              api.redis.clients.client.srem(api.chatRoom.keys.rooms, room, () => {
                api.redis.clients.client.del(api.chatRoom.keys.members + room, () => {
                  if (typeof callback === 'function') { callback() }
                })
              })
            })
          })
        } else {
          if (typeof callback === 'function') { callback(api.config.errors.connectionRoomNotExist(room), null) }
        }
      })
    }

    /**
     * This callback is invoked with an error or nothing.
     * @callback simpleCallback
     * @param {Error} error An error or null.
     */

    /**
     * Check if a room exists.
     *
     * @param  {string}  room The name of the room
     * @param {booleanCallback} The callback that handles the response.
     */
    api.chatRoom.exists = function (room, callback) {
      api.redis.clients.client.sismember(api.chatRoom.keys.rooms, room, (error, bool) => {
        let found = false
        if (bool === 1 || bool === true) {
          found = true
        }
        if (typeof callback === 'function') { callback(error, found) }
      })
    }

    /**
     * An overwritable method which configures what properties of connections in a room to return via `api.chatRoom.roomStatus`
     *
     * @param  {Object} memberData A connection
     * @return {Object} sanitizedMemberDetails The resulting object
     * @see api.chatRoom.roomStatus
     */
    api.chatRoom.sanitizeMemberDetails = function (memberData) {
      return {
        id: memberData.id,
        joinedAt: memberData.joinedAt
      }
    }

    /**
     * Learn about the connections in the room
     *
     * @param  {string}  room The name of the room
     * @return {Promise<Object>} Returns a hash of the form { room: room, members: cleanedMembers, membersCount: count }.  Members is an array of connections in the room sanitized via `api.chatRoom.sanitizeMemberDetails`
     * @param {roomStatusCallback} callback The callback that handles the response.
     */
    api.chatRoom.roomStatus = function (room, callback) {
      if (room) {
        api.chatRoom.exists(room, (error, found) => {
          if (error) { return callback(error) }
          if (found === true) {
            const key = api.chatRoom.keys.members + room
            api.redis.clients.client.hgetall(key, (error, members) => {
              if (error) { return callback(error) }

              let cleanedMembers = {}
              let count = 0
              for (let id in members) {
                const data = JSON.parse(members[id])
                cleanedMembers[id] = api.chatRoom.sanitizeMemberDetails(data)
                count++
              }
              callback(null, {
                room: room,
                members: cleanedMembers,
                membersCount: count
              })
            })
          } else {
            if (typeof callback === 'function') { callback(api.config.errors.connectionRoomNotExist(room), null) }
          }
        })
      } else {
        if (typeof callback === 'function') { callback(api.config.errors.connectionRoomRequired(), null) }
      }
    }

    /**
     * This callback is invoked with an error or an object hash in the form:
     * { room: room, members: cleanedMembers, membersCount: count }.
     * Members is an array of connections in the room sanitized via `api.chatRoom.sanitizeMemberDetails`.
     * @callback roomStatusCallback
     * @param {Error} error An error or null.
     * @param {object} roomStatus Object hash in the form: { room: room, members: cleanedMembers, membersCount: count }
     */

    /**
     * An overwritable method which configures what properties of connections in a room are initially stored about a connection when added via `api.chatRoom.addMember`
     *
     * @param  {Object} connection A ActionHero.Connection
     * @return {Object} sanitizedConnection The resulting object
     * @see api.chatRoom.addMember
     */
    api.chatRoom.generateMemberDetails = function (connection) {
      return {
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: api.id
      }
    }

    /**
     * Add a connection (via id) to a rooom.  Throws errors if the room does not exist, or the connection is already in the room.  Middleware errors also throw.
     *
     * @param  {string}  connectionId An existing connection's ID
     * @param  {srting}  room         The name of the room.
     * @param {booleanCallback}
     * @see api.chatRoom.removeMember
     */
    api.chatRoom.addMember = function (connectionId, room, callback) {
      if (api.connections.connections[connectionId]) {
        const connection = api.connections.connections[connectionId]
        if (connection.rooms.indexOf(room) < 0) {
          api.chatRoom.exists(room, (error, found) => {
            if (error) { return callback(error) }

            if (found === true) {
              api.chatRoom.handleCallbacks(connection, room, 'join', null, (error) => {
                if (error) {
                  callback(error, false)
                } else {
                  const memberDetails = api.chatRoom.generateMemberDetails(connection)
                  api.redis.clients.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails), () => {
                    connection.rooms.push(room)
                    if (typeof callback === 'function') { callback(null, true) }
                  })
                }
              })
            } else {
              if (typeof callback === 'function') { callback(api.config.errors.connectionRoomNotExist(room), false) }
            }
          })
        } else {
          if (typeof callback === 'function') { callback(api.config.errors.connectionAlreadyInRoom(connection, room), false) }
        }
      } else {
        api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, callback)
      }
    }

    /**
     * Remote a connection (via id) from a rooom.  Throws errors if the room does not exist, or the connection is not in the room.  Middleware errors also throw.
     *
     * @param  {string}  connectionId  An existing connection's ID
     * @param  {srting}  room          The name of the room.
     * @param  {Boolean}  toWaitRemote Should this method wait until the remote ActionHero server (the one the connection is connected too) responds?
     * @param {booleanCallback}
     * @see api.chatRoom.addMember
     */
    api.chatRoom.removeMember = function (connectionId, room, callback) {
      if (api.connections.connections[connectionId]) {
        const connection = api.connections.connections[connectionId]
        if (connection.rooms.indexOf(room) > -1) {
          api.chatRoom.exists(room, (error, found) => {
            if (error) { return callback(error) }

            if (found) {
              api.chatRoom.handleCallbacks(connection, room, 'leave', null, (error) => {
                if (error) {
                  callback(error, false)
                } else {
                  api.redis.clients.client.hdel(api.chatRoom.keys.members + room, connection.id, () => {
                    const index = connection.rooms.indexOf(room)
                    if (index > -1) { connection.rooms.splice(index, 1) }
                    if (typeof callback === 'function') { callback(null, true) }
                  })
                }
              })
            } else {
              if (typeof callback === 'function') { callback(api.config.errors.connectionRoomNotExist(room), false) }
            }
          })
        } else {
          if (typeof callback === 'function') { callback(api.config.errors.connectionNotInRoom(connection, room), false) }
        }
      } else {
        api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, callback)
      }
    }

    /**
     * @private
     */
    api.chatRoom.handleCallbacks = function (connection, room, direction, messagePayload, callback) {
      let jobs = []
      let newMessagePayload
      if (messagePayload) { newMessagePayload = api.utils.objClone(messagePayload) }

      api.chatRoom.globalMiddleware.forEach((name) => {
        const m = api.chatRoom.middleware[name]
        if (typeof m[direction] === 'function') {
          jobs.push((done) => {
            if (messagePayload) {
              m[direction](connection, room, newMessagePayload, (error, data) => {
                if (data) { newMessagePayload = data }
                done(error, data)
              })
            } else {
              m[direction](connection, room, done)
            }
          })
        }
      })

      async.series(jobs, (error, data) => {
        while (data.length > 0) {
          const thisData = data.shift()
          if (thisData) { newMessagePayload = thisData }
        }
        callback(error, newMessagePayload)
      })
    }

    next()
  },

  start: function (api, next) {
    api.redis.subscriptionHandlers.chat = (message) => {
      if (api.chatRoom) {
        api.chatRoom.incomingMessage(message)
      }
    }

    if (api.config.general.startingChatRooms) {
      for (let room in api.config.general.startingChatRooms) {
        api.log(`ensuring the existence of the chatRoom: ${room}`)
        api.chatRoom.add(room)
      }
    }

    next()
  }

}
