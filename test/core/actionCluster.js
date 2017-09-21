'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))

const actionhero1 = new ActionHero.Process()
const actionhero2 = new ActionHero.Process()
const actionhero3 = new ActionHero.Process()

const sleep = async (timeout) => {
  await new Promise((resolve) => setTimeout(resolve, timeout))
}

let apiA
let apiB
let apiC

let configChanges = {
  1: {
    general: {id: 'test-server-1'},
    servers: {}
  },
  2: {
    general: {id: 'test-server-2'},
    servers: {}
  },
  3: {
    general: {id: 'test-server-3'},
    servers: {}
  }
}

const startAllServers = async () => {
  apiA = await actionhero1.start({configChanges: configChanges[1]})
  apiB = await actionhero2.start({configChanges: configChanges[2]})
  apiC = await actionhero3.start({configChanges: configChanges[3]})
}

const stopAllServers = async () => {
  await actionhero1.stop()
  await actionhero2.stop()
  await actionhero3.stop()
}

describe('Core: Action Cluster', () => {
  before(async () => {
    await startAllServers()
    for (var room in apiA.config.general.startingChatRooms) {
      try {
        await apiA.chatRoom.destroy(room)
        await apiA.chatRoom.add(room)
      } catch (error) {
        if (!error.toString().match(apiA.config.errors.connectionRoomExists(room))) { throw error }
      }
    }
  })

  after(async () => { await stopAllServers() })

  describe('say and clients on separate servers', () => {
    let client1
    let client2
    let client3

    before(async () => {
      client1 = new apiA.specHelper.Connection()
      client2 = new apiB.specHelper.Connection()
      client3 = new apiC.specHelper.Connection()

      client1.verbs('roomAdd', 'defaultRoom')
      client2.verbs('roomAdd', 'defaultRoom')
      client3.verbs('roomAdd', 'defaultRoom')
      await sleep(100)
    })

    after(async () => {
      client1.destroy()
      client2.destroy()
      client3.destroy()
      await sleep(100)
    })

    it('all connections can join the default room and client #1 can see them', async () => {
      let {room, membersCount} = await client1.verbs('roomView', 'defaultRoom')
      expect(room).to.equal('defaultRoom')
      expect(membersCount).to.equal(3)
    })

    it('all connections can join the default room and client #2 can see them', async () => {
      let {room, membersCount} = await client2.verbs('roomView', 'defaultRoom')
      expect(room).to.equal('defaultRoom')
      expect(membersCount).to.equal(3)
    })

    it('all connections can join the default room and client #3 can see them', async () => {
      let {room, membersCount} = await client3.verbs('roomView', 'defaultRoom')
      expect(room).to.equal('defaultRoom')
      expect(membersCount).to.equal(3)
    })

    it('clients can communicate across the cluster', async () => {
      await client1.verbs('say', ['defaultRoom', 'Hi', 'from', 'client', '1'])
      await sleep(100)

      let {message, room, from} = client2.messages[(client2.messages.length - 1)]
      expect(message).to.equal('Hi from client 1')
      expect(room).to.equal('defaultRoom')
      expect(from).to.equal(client1.id)
    })
  })

  describe('shared cache', () => {
    it('peer 1 writes and peer 2 should read', async () => {
      await apiA.cache.save('test_key', 'yay')
      let {value} = await apiB.cache.load('test_key')
      expect(value).to.equal('yay')
    })

    it('peer 3 deletes and peer 1 cannot read any more', async () => {
      await apiC.cache.destroy('test_key')
      try {
        await apiA.cache.load('test_key')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: Object not found')
      }
    })
  })

  describe('RPC', () => {
    before(async () => { await sleep(1000) })

    afterEach(() => {
      delete apiA.rpcTestMethod
      delete apiB.rpcTestMethod
      delete apiC.rpcTestMethod
    })

    it('can call remote methods on all other servers in the cluster', async () => {
      let data = {}

      apiA.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }
      apiB.rpcTestMethod = (arg1, arg2) => { data[2] = [arg1, arg2] }
      apiC.rpcTestMethod = (arg1, arg2) => { data[3] = [arg1, arg2] }

      await apiA.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'])
      await sleep(100)

      expect(data[1][0]).to.equal('arg1')
      expect(data[1][1]).to.equal('arg2')
      expect(data[2][0]).to.equal('arg1')
      expect(data[2][1]).to.equal('arg2')
      expect(data[3][0]).to.equal('arg1')
      expect(data[3][1]).to.equal('arg2')
    })

    it('can call remote methods only on one other cluster who holds a specific connectionId', async () => {
      let client = new apiA.specHelper.Connection()

      let data = {}
      apiA.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }
      apiB.rpcTestMethod = (arg1, arg) => { throw new Error('should not be here') }
      apiC.rpcTestMethod = (arg1, arg2) => { throw new Error('should not be here') }

      await apiB.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id)
      await sleep(100)

      expect(data[1][0]).to.equal('arg1')
      expect(data[1][1]).to.equal('arg2')
      client.destroy()
    })

    it('can get information about connections connected to other servers', async () => {
      let client = new apiA.specHelper.Connection()

      let {id, type, canChat} = await apiB.connections.apply(client.id)
      expect(id).to.equal(client.id)
      expect(type).to.equal('testServer')
      expect(canChat).to.equal(true)
    })

    it('can call remote methods on/about connections connected to other servers', async () => {
      let client = new apiA.specHelper.Connection()
      expect(client.auth).to.not.exist()

      let connection = await apiB.connections.apply(client.id, 'set', ['auth', true])
      expect(connection.id).to.equal(client.id)
      expect(client.auth).to.equal(true)
      client.destroy()
    })

    it('can send arbitraty messages to connections connected to other servers', async () => {
      let client = new apiA.specHelper.Connection()

      let connection = await apiB.connections.apply(client.id, 'sendMessage', {message: 'hi'})
      let message = connection.messages[(connection.messages.length - 1)]
      expect(message.message).to.equal('hi')
    })

    it('failing RPC calls with a callback will have a failure callback', async () => {
      try {
        await apiB.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', true)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: RPC Timeout')
      }
    })
  })

  describe('chat', () => {
    beforeEach(async () => {
      try {
        await apiA.chatRoom.destroy('newRoom')
      } catch (error) {
        // it's fine
      }
    })

    it('can check if rooms exist', async () => {
      let found = await apiA.chatRoom.exists('defaultRoom')
      expect(found).to.equal(true)
    })

    it('can check if a room does not exist', async () => {
      let found = await apiA.chatRoom.exists('missingRoom')
      expect(found).to.equal(false)
    })

    it('server can create new room', async () => {
      let room = 'newRoom'
      let found
      found = await apiA.chatRoom.exists(room)
      expect(found).to.equal(false)
      await apiA.chatRoom.add(room)
      found = await apiA.chatRoom.exists(room)
      expect(found).to.equal(true)
    })

    it('server cannot create already existing room', async () => {
      try {
        await apiA.chatRoom.add('defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: room exists')
      }
    })

    it('can enumerate all the rooms in the system', async () => {
      await apiA.chatRoom.add('newRoom')
      let rooms = await apiA.chatRoom.list()
      expect(rooms).to.have.length(3);
      ['defaultRoom', 'newRoom', 'otherRoom'].forEach((r) => {
        expect(rooms.indexOf(r)).to.be.above(-1)
      })
    })

    it('server can add connections to a LOCAL room', async () => {
      let client = new apiA.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      let didAdd = await apiA.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      expect(client.rooms[0]).to.equal('defaultRoom')
      client.destroy()
    })

    it('server can add connections to a REMOTE room', async () => {
      let client = new apiB.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      let didAdd = await apiA.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      expect(client.rooms).to.have.length(1)
      expect(client.rooms[0]).to.equal('defaultRoom')
    })

    it('will not re-add a member to a room', async () => {
      let client = new apiA.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      let didAdd = await apiA.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      try {
        didAdd = await apiA.chatRoom.addMember(client.id, 'defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: connection already in this room (defaultRoom)')
        client.destroy()
      }
    })

    it('will not add a member to a non-existant room', async () => {
      let client = new apiA.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      try {
        await apiA.chatRoom.addMember(client.id, 'crazyRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: room does not exist')
        client.destroy()
      }
    })

    it('server will not remove a member not in a room', async () => {
      let client = new apiA.specHelper.Connection()
      try {
        await apiA.chatRoom.removeMember(client.id, 'defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: connection not in this room (defaultRoom)')
        client.destroy()
      }
    })

    it('server can remove connections to a room (local)', async () => {
      let client = new apiA.specHelper.Connection()
      let didAdd = await apiA.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      let didRemove = await apiA.chatRoom.removeMember(client.id, 'defaultRoom')
      expect(didRemove).to.equal(true)
      client.destroy()
    })

    it('server can remove connections to a room (remote)', async () => {
      let client = new apiB.specHelper.Connection()
      let didAdd = await apiB.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      let didRemove = await apiA.chatRoom.removeMember(client.id, 'defaultRoom')
      expect(didRemove).to.equal(true)
      client.destroy()
    })

    it('server can destroy a room and connections will be removed', async () => {
      try {
        // to ensure it starts empty
        await apiA.chatRoom.destroy('newRoom')
      } catch (error) { }

      let client = new apiA.specHelper.Connection()
      await apiA.chatRoom.add('newRoom')
      let didAdd = await apiA.chatRoom.addMember(client.id, 'newRoom')
      expect(didAdd).to.equal(true)
      expect(client.rooms[0]).to.equal('newRoom')

      await apiA.chatRoom.destroy('newRoom')
      expect(client.rooms).to.have.length(0)

      // testing for the recepit of this message is a race condition with room.destroy and boradcast in test
      // client.messages[1].message.should.equal('this room has been deleted')
      // client.messages[1].room.should.equal('newRoom')

      client.destroy()
    })

    it('can get a list of room members', async () => {
      let client = new apiA.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      await apiA.chatRoom.add('newRoom')
      await apiA.chatRoom.addMember(client.id, 'newRoom')
      let {room, membersCount} = await apiA.chatRoom.roomStatus('newRoom')
      expect(room).to.equal('newRoom')
      expect(membersCount).to.equal(1)
      client.destroy()
      await apiA.chatRoom.destroy('newRoom')
    })

    describe('chat middleware', () => {
      let clientA
      let clientB
      let originalGenerateMessagePayload

      beforeEach(() => {
        originalGenerateMessagePayload = apiA.chatRoom.generateMessagePayload
        clientA = new apiA.specHelper.Connection()
        clientB = new apiA.specHelper.Connection()
      })

      afterEach(() => {
        apiA.chatRoom.middleware = {}
        apiA.chatRoom.globalMiddleware = []

        clientA.destroy()
        clientB.destroy()

        apiA.chatRoom.generateMessagePayload = originalGenerateMessagePayload
      })

      it('generateMessagePayload can be overloaded', async () => {
        apiA.chatRoom.generateMessagePayload = (message) => {
          return {
            thing: 'stuff',
            room: message.connection.room,
            from: message.connection.id
          }
        }

        await clientA.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomAdd', 'defaultRoom')
        await clientA.verbs('say', ['defaultRoom', 'hi there'])
        await sleep(100)
        let message = clientB.messages[(clientB.messages.length - 1)]
        expect(message.thing).to.equal('stuff')
        expect(message.message).to.not.exist()
      })

      it('(join + leave) can add middleware to announce members', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'add chat middleware',
          join: async (connection, room) => {
            await apiA.chatRoom.broadcast({}, room, `I have entered the room: ${connection.id}`)
          }
        })

        apiA.chatRoom.addMiddleware({
          name: 'leave chat middleware',
          leave: async (connection, room) => {
            await apiA.chatRoom.broadcast({}, room, `I have left the room: ${connection.id}`)
          }
        })

        await clientA.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomLeave', 'defaultRoom')
        await sleep(100)

        expect(clientA.messages.pop().message).to.equal('I have left the room: ' + clientB.id)
        expect(clientA.messages.pop().message).to.equal('I have entered the room: ' + clientB.id)
      })

      it('(say) can modify message payloads', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'chat middleware',
          say: (connection, room, messagePayload) => {
            if (messagePayload.from !== 0) { messagePayload.message = 'something else' }
            return messagePayload
          }
        })

        await clientA.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
        await sleep(100)

        let lastMessage = clientA.messages[(clientA.messages.length - 1)]
        expect(lastMessage.message).to.equal('something else')
      })

      it('can add middleware in a particular order and will be passed modified messagePayloads', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'chat middleware 1',
          priority: 1000,
          say: (connection, room, messagePayload, callback) => {
            messagePayload.message = 'MIDDLEWARE 1'
            return messagePayload
          }
        })

        apiA.chatRoom.addMiddleware({
          name: 'chat middleware 2',
          priority: 2000,
          say: (connection, room, messagePayload) => {
            messagePayload.message = messagePayload.message + ' MIDDLEWARE 2'
            return messagePayload
          }
        })

        await clientA.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
        await sleep(100)

        let lastMessage = clientA.messages[(clientA.messages.length - 1)]
        expect(lastMessage.message).to.equal('MIDDLEWARE 1 MIDDLEWARE 2')
      })

      it('say middleware can block excecution', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'chat middleware',
          say: (connection, room, messagePayload) => {
            throw new Error('messages blocked')
          }
        })

        await clientA.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('roomAdd', 'defaultRoom')
        await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
        await sleep(100)

        // welcome message is passed, no join/leave/or say messages
        expect(clientA.messages).to.have.length(1)
        expect(clientA.messages[0].welcome).to.match(/Welcome/)
      })

      it('join middleware can block excecution', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'chat middleware',
          join: (connection, room) => {
            throw new Error('joining rooms blocked')
          }
        })

        try {
          await clientA.verbs('roomAdd', 'defaultRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).to.equal('Error: joining rooms blocked')
          expect(clientA.rooms).to.have.length(0)
        }
      })

      it('leave middleware can block excecution', async () => {
        apiA.chatRoom.addMiddleware({
          name: 'chat middleware',
          leave: (connection, room) => {
            throw new Error('Hotel California')
          }
        })

        let didJoin = await clientA.verbs('roomAdd', 'defaultRoom')
        expect(didJoin).to.equal(true)
        expect(clientA.rooms).to.have.length(1)
        expect(clientA.rooms[0]).to.equal('defaultRoom')

        try {
          await clientA.verbs('roomLeave', 'defaultRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).to.equal('Error: Hotel California')
          expect(clientA.rooms).to.have.length(1)
        }
      })
    })
  })
})
