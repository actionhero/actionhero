'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core', () => {
  describe('chatRoom', () => {
    beforeAll(async () => {
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

    afterAll(async () => { await actionhero.stop() })

    describe('say and clients on separate servers', () => {
      let client1
      let client2
      let client3

      beforeAll(async () => {
        client1 = await api.specHelper.Connection.createAsync()
        client2 = await api.specHelper.Connection.createAsync()
        client3 = await api.specHelper.Connection.createAsync()

        client1.verbs('roomAdd', 'defaultRoom')
        client2.verbs('roomAdd', 'defaultRoom')
        client3.verbs('roomAdd', 'defaultRoom')
        await api.utils.sleep(100)
      })

      afterAll(async () => {
        client1.destroy()
        client2.destroy()
        client3.destroy()
        await api.utils.sleep(100)
      })

      test(
        'all connections can join the default room and client #1 can see them',
        async () => {
          const { room, membersCount } = await client1.verbs('roomView', 'defaultRoom')
          expect(room).toEqual('defaultRoom')
          expect(membersCount).toEqual(3)
        }
      )

      test(
        'all connections can join the default room and client #2 can see them',
        async () => {
          const { room, membersCount } = await client2.verbs('roomView', 'defaultRoom')
          expect(room).toEqual('defaultRoom')
          expect(membersCount).toEqual(3)
        }
      )

      test(
        'all connections can join the default room and client #3 can see them',
        async () => {
          const { room, membersCount } = await client3.verbs('roomView', 'defaultRoom')
          expect(room).toEqual('defaultRoom')
          expect(membersCount).toEqual(3)
        }
      )

      test('clients can communicate across the cluster', async () => {
        await client1.verbs('say', ['defaultRoom', 'Hi', 'from', 'client', '1'])
        await api.utils.sleep(100)

        const { message, room, from } = client2.messages[(client2.messages.length - 1)]
        expect(message).toEqual('Hi from client 1')
        expect(room).toEqual('defaultRoom')
        expect(from).toEqual(client1.id)
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

      test('can check if rooms exist', async () => {
        const found = await api.chatRoom.exists('defaultRoom')
        expect(found).toEqual(true)
      })

      test('can check if a room does not exist', async () => {
        const found = await api.chatRoom.exists('missingRoom')
        expect(found).toEqual(false)
      })

      test('server can create new room', async () => {
        const room = 'newRoom'
        let found
        found = await api.chatRoom.exists(room)
        expect(found).toEqual(false)
        await api.chatRoom.add(room)
        found = await api.chatRoom.exists(room)
        expect(found).toEqual(true)
      })

      test('server cannot create already existing room', async () => {
        try {
          await api.chatRoom.add('defaultRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toEqual('Error: room exists')
        }
      })

      test('can enumerate all the rooms in the system', async () => {
        await api.chatRoom.add('newRoom')
        const rooms = await api.chatRoom.list()
        expect(rooms).toHaveLength(3);
        ['defaultRoom', 'newRoom', 'otherRoom'].forEach((r) => {
          expect(rooms.indexOf(r)).toBeGreaterThan(-1)
        })
      })

      test('server can add connections to a LOCAL room', async () => {
        const client = await api.specHelper.Connection.createAsync()
        expect(client.rooms).toHaveLength(0)
        const didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
        expect(didAdd).toEqual(true)
        expect(client.rooms[0]).toEqual('defaultRoom')
        client.destroy()
      })

      test('will not re-add a member to a room', async () => {
        const client = await api.specHelper.Connection.createAsync()
        expect(client.rooms).toHaveLength(0)
        let didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
        expect(didAdd).toEqual(true)
        try {
          didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toEqual('Error: connection already in this room (defaultRoom)')
          client.destroy()
        }
      })

      test('will not add a member to a non-existant room', async () => {
        const client = await api.specHelper.Connection.createAsync()
        expect(client.rooms).toHaveLength(0)
        try {
          await api.chatRoom.addMember(client.id, 'crazyRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toEqual('Error: room does not exist')
          client.destroy()
        }
      })

      test('server will not remove a member not in a room', async () => {
        const client = await api.specHelper.Connection.createAsync()
        try {
          await api.chatRoom.removeMember(client.id, 'defaultRoom')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toEqual('Error: connection not in this room (defaultRoom)')
          client.destroy()
        }
      })

      test('server can remove connections to a room', async () => {
        const client = await api.specHelper.Connection.createAsync()
        const didAdd = await api.chatRoom.addMember(client.id, 'defaultRoom')
        expect(didAdd).toEqual(true)
        const didRemove = await api.chatRoom.removeMember(client.id, 'defaultRoom')
        expect(didRemove).toEqual(true)
        client.destroy()
      })

      test('server can destroy a room and connections will be removed', async () => {
        try {
          // to ensure it starts empty
          await api.chatRoom.destroy('newRoom')
        } catch (error) { }

        const client = await api.specHelper.Connection.createAsync()
        await api.chatRoom.add('newRoom')
        const didAdd = await api.chatRoom.addMember(client.id, 'newRoom')
        expect(didAdd).toEqual(true)
        expect(client.rooms[0]).toEqual('newRoom')

        await api.chatRoom.destroy('newRoom')
        expect(client.rooms).toHaveLength(0)

        // testing for the recepit of this message is a race condition with room.destroy and boradcast in test
        // client.messages[1].message.should.equal('this room has been deleted')
        // client.messages[1].room.should.equal('newRoom')

        client.destroy()
      })

      test('can get a list of room members', async () => {
        const client = await api.specHelper.Connection.createAsync()
        expect(client.rooms).toHaveLength(0)
        await api.chatRoom.add('newRoom')
        await api.chatRoom.addMember(client.id, 'newRoom')
        const { room, membersCount } = await api.chatRoom.roomStatus('newRoom')
        expect(room).toEqual('newRoom')
        expect(membersCount).toEqual(1)
        client.destroy()
        await api.chatRoom.destroy('newRoom')
      })

      describe('chat middleware', () => {
        let clientA
        let clientB
        let originalGenerateMessagePayload

        beforeEach(async () => {
          originalGenerateMessagePayload = api.chatRoom.generateMessagePayload
          clientA = await api.specHelper.Connection.createAsync()
          clientB = await api.specHelper.Connection.createAsync()
        })

        afterEach(() => {
          api.chatRoom.middleware = {}
          api.chatRoom.globalMiddleware = []

          clientA.destroy()
          clientB.destroy()

          api.chatRoom.generateMessagePayload = originalGenerateMessagePayload
        })

        test('generateMessagePayload can be overloaded', async () => {
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
          await api.utils.sleep(100)
          const message = clientB.messages[(clientB.messages.length - 1)]
          expect(message.thing).toEqual('stuff')
          expect(message.message).toBeUndefined()
        })

        test('(join + leave) can add middleware to announce members', async () => {
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
          await api.utils.sleep(100)

          expect(clientA.messages.pop().message).toEqual('I have left the room: ' + clientB.id)
          expect(clientA.messages.pop().message).toEqual('I have entered the room: ' + clientB.id)
        })

        test('(say) can modify message payloads', async () => {
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
          await api.utils.sleep(100)

          const lastMessage = clientA.messages[(clientA.messages.length - 1)]
          expect(lastMessage.message).toEqual('something else')
        })

        test(
          'can add middleware in a particular order and will be passed modified messagePayloads',
          async () => {
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
            await api.utils.sleep(100)

            const lastMessage = clientA.messages[(clientA.messages.length - 1)]
            expect(lastMessage.message).toEqual('MIDDLEWARE 1 MIDDLEWARE 2')
          }
        )

        test('say middleware can block excecution', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: (connection, room, messagePayload) => {
              throw new Error('messages blocked')
            }
          })

          await clientA.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
          await api.utils.sleep(100)

          // welcome message is passed, no join/leave/or say messages
          expect(clientA.messages).toHaveLength(1)
          expect(clientA.messages[0].welcome).toMatch(/Welcome/)
        })

        test('join middleware can block excecution', async () => {
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
            expect(error.toString()).toEqual('Error: joining rooms blocked')
            expect(clientA.rooms).toHaveLength(0)
          }
        })

        test('leave middleware can block excecution', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            leave: (connection, room) => {
              throw new Error('Hotel California')
            }
          })

          const didJoin = await clientA.verbs('roomAdd', 'defaultRoom')
          expect(didJoin).toEqual(true)
          expect(clientA.rooms).toHaveLength(1)
          expect(clientA.rooms[0]).toEqual('defaultRoom')

          try {
            await clientA.verbs('roomLeave', 'defaultRoom')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.toString()).toEqual('Error: Hotel California')
            expect(clientA.rooms).toHaveLength(1)
          }
        })

        test('(say verb with async keyword) can modify message payloads', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: async (connection, room, messagePayload) => {
              if (messagePayload.from !== 0) { messagePayload.message = 'something else' }
              return messagePayload
            }
          })
          await clientA.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
          await api.utils.sleep(100)
          const lastMessage = clientA.messages[(clientA.messages.length - 1)]
          expect(lastMessage.message).toEqual('something else')
        })

        test(
          'can add middleware in a particular order and will be passed modified messagePayloads with both being async functions',
          async () => {
            api.chatRoom.addMiddleware({
              name: 'chat middleware 1',
              priority: 1000,
              say: async (connection, room, messagePayload, callback) => {
                messagePayload.message = 'MIDDLEWARE 1'
                return messagePayload
              }
            })

            api.chatRoom.addMiddleware({
              name: 'chat middleware 2',
              priority: 2000,
              say: async (connection, room, messagePayload) => {
                messagePayload.message = messagePayload.message + ' MIDDLEWARE 2'
                return messagePayload
              }
            })

            await clientA.verbs('roomAdd', 'defaultRoom')
            await clientB.verbs('roomAdd', 'defaultRoom')
            await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
            await api.utils.sleep(100)

            const lastMessage = clientA.messages[(clientA.messages.length - 1)]
            expect(lastMessage.message).toEqual('MIDDLEWARE 1 MIDDLEWARE 2')
          }
        )

        test('say async function middleware can block execution', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: async (connection, room, messagePayload) => {
              throw new Error('messages blocked')
            }
          })

          await clientA.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('roomAdd', 'defaultRoom')
          await clientB.verbs('say', ['defaultRoom', 'something', 'awesome'])
          await api.utils.sleep(100)

          // welcome message is passed, no join/leave/or say messages
          expect(clientA.messages).toHaveLength(1)
          expect(clientA.messages[0].welcome).toMatch(/Welcome/)
        })

        test('join async function middleware can block execution', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            join: async (connection, room) => {
              throw new Error('joining rooms blocked')
            }
          })

          try {
            await clientA.verbs('roomAdd', 'defaultRoom')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.toString()).toEqual('Error: joining rooms blocked')
            expect(clientA.rooms).toHaveLength(0)
          }
        })

        test('leave async function middleware can block execution', async () => {
          api.chatRoom.addMiddleware({
            name: 'chat middleware',
            leave: async (connection, room) => {
              throw new Error('Hotel California')
            }
          })

          const didJoin = await clientA.verbs('roomAdd', 'defaultRoom')
          expect(didJoin).toEqual(true)
          expect(clientA.rooms).toHaveLength(1)
          expect(clientA.rooms[0]).toEqual('defaultRoom')

          try {
            await clientA.verbs('roomLeave', 'defaultRoom')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.toString()).toEqual('Error: Hotel California')
            expect(clientA.rooms).toHaveLength(1)
          }
        })
      })
    })
  })
})
