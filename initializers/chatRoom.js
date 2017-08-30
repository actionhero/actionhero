'use strict'

module.exports = {
  startPriority: 200,
  loadPriority: 520,
  initialize: function (api) {
    api.chatRoom = {}
    api.chatRoom.keys = {
      rooms: 'actionhero:chatRoom:rooms',
      members: 'actionhero:chatRoom:members:'
    }
    api.chatRoom.messageChannel = '/actionhero/chat/chat'

    api.chatRoom.middleware = {}
    api.chatRoom.globalMiddleware = []

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

    api.chatRoom.broadcast = async function (connection, room, message) {
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

        let newPayload = await api.chatRoom.handleCallbacks(connection, messagePayload.room, 'onSayReceive', messagePayload)
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

    api.chatRoom.generateMessagePayload = function (message) {
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: 'user',
        sentAt: message.sentAt
      }
    }

    api.chatRoom.incomingMessage = function (message) {
      const messagePayload = api.chatRoom.generateMessagePayload(message)
      for (let i in api.connections.connections) {
        api.chatRoom.incomingMessagePerConnection(api.connections.connections[i], messagePayload)
      }
    }

    api.chatRoom.incomingMessagePerConnection = function (connection, messagePayload) {
      if (connection.canChat === true) {
        if (connection.rooms.indexOf(messagePayload.room) > -1) {
          api.chatRoom.handleCallbacks(connection, messagePayload.room, 'say', messagePayload, (error, newMessagePayload) => {
            if (!error) { connection.sendMessage(newMessagePayload, 'say') }
          })
        }
      }
    }

    api.chatRoom.list = async function () {
      return api.redis.clients.client.smembers(api.chatRoom.keys.rooms)
    }

    api.chatRoom.add = async function (room) {
      let found = await api.chatRoom.exists(room)
      if (found === false) {
        return api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room)
      } else {
        return api.config.errors.connectionRoomExists(room)
      }
    }

    api.chatRoom.destroy = async function (room) {
      let found = await api.chatRoom.exists(room)
      if (found === true) {
        await api.chatRoom.broadcast({}, room, api.config.errors.connectionRoomHasBeenDeleted(room))
        let membersHash = await api.redis.clients.client.hgetall(api.chatRoom.keys.members + room)

        for (let id in membersHash) {
          await api.chatRoom.removeMember(id, room)
        }

        await api.redis.clients.client.srem(api.chatRoom.keys.rooms, room)
        await api.redis.clients.client.del(api.chatRoom.keys.members + room)
      } else {
        return api.config.errors.connectionRoomNotExist(room)
      }
    }

    api.chatRoom.exists = async function (room) {
      let bool = await api.redis.clients.client.sismember(api.chatRoom.keys.rooms, room)
      let found = false
      if (bool === 1 || bool === true) { found = true }
      return found
    }

    api.chatRoom.sanitizeMemberDetails = function (memberData) {
      return {
        id: memberData.id,
        joinedAt: memberData.joinedAt
      }
    }

    api.chatRoom.roomStatus = async function (room) {
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
          throw api.config.errors.connectionRoomNotExist(room)
        }
      } else {
        throw api.config.errors.connectionRoomRequired()
      }
    }

    api.chatRoom.generateMemberDetails = function (connection) {
      return {
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: api.id
      }
    }

    api.chatRoom.addMember = async function (connectionId, room) {
      let connection = api.connections.connections[connectionId]
      if (connection) {
        if (connection.rooms.indexOf(room) < 0) {
          let found = await api.chatRoom.exists(room)
          if (found === true) {
            await api.chatRoom.handleCallbacks(connection, room, 'join', null)
            let memberDetails = api.chatRoom.generateMemberDetails(connection)
            await api.redis.clients.client.hset(api.chatRoom.keys.members + room, connection.id, JSON.stringify(memberDetails))
            connection.rooms.push(room)
            return true
          } else {
            throw api.config.errors.connectionRoomNotExist(room)
          }
        } else {
          throw api.config.errors.connectionAlreadyInRoom(connection, room)
        }
      } else {
        return api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, true)
      }
    }

    api.chatRoom.removeMember = async function (connectionId, room) {
      let connection = api.connections.connections[connectionId]
      if (connection) {
        if (connection.rooms.indexOf(room) > -1) {
          let found = await api.chatRoom.exists(room)
          if (found) {
            await api.chatRoom.handleCallbacks(connection, room, 'leave', null)
            await api.redis.clients.client.hdel(api.chatRoom.keys.members + room, connection.id)
            let index = connection.rooms.indexOf(room)
            if (index > -1) { connection.rooms.splice(index, 1) }
            return true
          } else {
            throw api.config.errors.connectionRoomNotExist(room)
          }
        } else {
          throw api.config.errors.connectionNotInRoom(connection, room)
        }
      } else {
        return api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, true)
      }
    }

    api.chatRoom.handleCallbacks = function (connection, room, direction, messagePayload) {
      let newMessagePayload
      if (messagePayload) { newMessagePayload = api.utils.objClone(messagePayload) }

      api.chatRoom.globalMiddleware.forEach(async (name) => {
        const m = api.chatRoom.middleware[name]
        if (typeof m[direction] === 'function') {
          if (messagePayload) {
            let data = await m[direction](connection, room, newMessagePayload)
            if (data) { newMessagePayload = data }
          } else {
            await m[direction](connection, room)
          }
        }
      })

      return newMessagePayload
    }
  },

  start: async function (api) {
    api.redis.subscriptionHandlers.chat = (message) => {
      if (api.chatRoom) { api.chatRoom.incomingMessage(message) }
    }

    if (api.config.general.startingChatRooms) {
      Object.keys(api.config.general.startingChatRooms).forEach(async (room) => {
        api.log(`ensuring the existence of the chatRoom: ${room}`)
        await api.chatRoom.add(room)
      })
    }
  }
}
