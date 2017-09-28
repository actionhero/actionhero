'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

describe('Core: Action Cluster', () => {
  before(async () => {
    api = await actionhero.start()
    for (var room in api.config.general.startingChatRooms) {
      try {
        await api.chatRoom.destroy(room)
        await api.chatRoom.add(room)
      } catch (error) {
        if (!error.toString().match(api.config.errors.connectionRoomExists(room))) { throw error }
      }
    }
  })

  after(async () => { await actionhero.stop() })

  describe('say and clients on separate servers', () => {
    let client1
    let client2
    let client3

    before(async () => {
      client1 = new api.specHelper.Connection()
      client2 = new api.specHelper.Connection()
      client3 = new api.specHelper.Connection()

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

  describe('chat', () => {
    beforeEach(async () => {
      try {
        await api.chatRoom.destroy('newRoom')
      } catch (error) {
        // it's fine
      }
    })

    it('can check if rooms exist', async () => {
      let found = await api.chatRoom.exists('defaultRoom')
      expect(found).to.equal(true)
    })

    it('can check if a room does not exist', async () => {
      let found = await api.chatRoom.exists('missingRoom')
      expect(found).to.equal(false)
    })

    it('server can create new room', async () => {
      let room = 'newRoom'
      let found
      found = await api.chatRoom.exists(room)
      expect(found).to.equal(false)
      await api.chatRoom.add(room)
      found = await api.chatRoom.exists(room)
      expect(found).to.equal(true)
    })

    it('server cannot create already existing room', async () => {
      try {
        await api.chatRoom.add('defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: room exists')
      }
    })

    it('can enumerate all the rooms in the system', async () => {
      await api.chatRoom.add('newRoom')
      let rooms = await api.chatRoom.list()
      expect(rooms).to.have.length(3);
      ['defaultRoom', 'newRoom', 'otherRoom'].forEach((r) => {
        expect(rooms.indexOf(r)).to.be.above(-1)
      })
    })

    it('server can add connections to a LOCAL room', async () => {
      let client = new api.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      let didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      expect(client.rooms[0]).to.equal('defaultRoom')
      client.destroy()
    })

    it('will not re-add a member to a room', async () => {
      let client = new api.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      let didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      try {
        didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: connection already in this room (defaultRoom)')
        client.destroy()
      }
    })

    it('will not add a member to a non-existant room', async () => {
      let client = new api.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      try {
        await api.chatRoom.addMember(client.id, 'crazyRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: room does not exist')
        client.destroy()
      }
    })

    it('server will not remove a member not in a room', async () => {
      let client = new api.specHelper.Connection()
      try {
        await api.chatRoom.removeMember(client.id, 'defaultRoom')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: connection not in this room (defaultRoom)')
        client.destroy()
      }
    })

    it('server can remove connections to a room', async () => {
      let client = new api.specHelper.Connection()
      let didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
      expect(didAdd).to.equal(true)
      let didRemove = await api.chatRoom.removeMember(client.id, 'defaultRoom')
      expect(didRemove).to.equal(true)
      client.destroy()
    })

    it('server can destroy a room and connections will be removed', async () => {
      try {
        // to ensure it starts empty
        await api.chatRoom.destroy('newRoom')
      } catch (error) { }

      let client = new api.specHelper.Connection()
      await api.chatRoom.add('newRoom')
      let didAdd = await api.chatRoom.addMember(client.id, 'newRoom')
      expect(didAdd).to.equal(true)
      expect(client.rooms[0]).to.equal('newRoom')

      await api.chatRoom.destroy('newRoom')
      expect(client.rooms).to.have.length(0)

      // testing for the recepit of this message is a race condition with room.destroy and boradcast in test
      // client.messages[1].message.should.equal('this room has been deleted')
      // client.messages[1].room.should.equal('newRoom')

      client.destroy()
    })

    it('can get a list of room members', async () => {
      let client = new api.specHelper.Connection()
      expect(client.rooms).to.have.length(0)
      await api.chatRoom.add('newRoom')
      await api.chatRoom.addMember(client.id, 'newRoom')
      let {room, membersCount} = await api.chatRoom.roomStatus('newRoom')
      expect(room).to.equal('newRoom')
      expect(membersCount).to.equal(1)
      client.destroy()
      await api.chatRoom.destroy('newRoom')
    })

    describe('chat middleware', () => {
      let clientA
      let clientB
      let originalGenerateMessagePayload

      beforeEach(() => {
        originalGenerateMessagePayload = api.chatRoom.generateMessagePayload
        clientA = new api.specHelper.Connection()
        clientB = new api.specHelper.Connection()
      })

      afterEach(() => {
        api.chatRoom.middleware = {}
        api.chatRoom.globalMiddleware = []

        clientA.destroy()
        clientB.destroy()

        api.chatRoom.generateMessagePayload = originalGenerateMessagePayload
      })

      it('generateMessagePayload can be overloaded', async () => {
        api.chatRoom.generateMessagePayload = (message) => {
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
        api.chatRoom.addMiddleware({
          name: 'add chat middleware',
          join: async (connection, room) => {
            await api.chatRoom.broadcast({}, room, `I have entered the room: ${connection.id}`)
          }
        })

        api.chatRoom.addMiddleware({
          name: 'leave chat middleware',
          leave: async (connection, room) => {
            await api.chatRoom.broadcast({}, room, `I have left the room: ${connection.id}`)
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
        api.chatRoom.addMiddleware({
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
        api.chatRoom.addMiddleware({
          name: 'chat middleware 1',
          priority: 1000,
          say: (connection, room, messagePayload, callback) => {
            messagePayload.message = 'MIDDLEWARE 1'
            return messagePayload
          }
        })

        api.chatRoom.addMiddleware({
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
        api.chatRoom.addMiddleware({
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
        api.chatRoom.addMiddleware({
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
        api.chatRoom.addMiddleware({
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
