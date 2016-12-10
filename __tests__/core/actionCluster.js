'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))

var actionhero1 = new ActionheroPrototype()
var actionhero2 = new ActionheroPrototype()
var actionhero3 = new ActionheroPrototype()

var apiA
var apiB
var apiC

var configChanges = {
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

var startAllServers = (next) => {
  actionhero1.start({configChanges: configChanges[1]}, (error, a1) => {
    expect(error).toBeNull()
    actionhero2.start({configChanges: configChanges[2]}, (error, a2) => {
      expect(error).toBeNull()
      actionhero3.start({configChanges: configChanges[3]}, (error, a3) => {
        expect(error).toBeNull()
        apiA = a1
        apiB = a2
        apiC = a3
        next()
      })
    })
  })
}

var stopAllServers = (next) => {
  actionhero1.stop(() => {
    actionhero2.stop(() => {
      actionhero3.stop(next)
    })
  })
}

describe('Core: Action Cluster', () => {
  describe('servers', () => {
    beforeAll((done) => {
      startAllServers(done)
    })

    afterAll((done) => {
      stopAllServers(done)
    })

    describe('say and clients on separate servers', () => {
      var client1
      var client2
      var client3

      beforeAll((done) => {
        client1 = new apiA.specHelper.Connection()
        client2 = new apiB.specHelper.Connection()
        client3 = new apiC.specHelper.Connection()

        client1.verbs('roomAdd', 'defaultRoom')
        client2.verbs('roomAdd', 'defaultRoom')
        client3.verbs('roomAdd', 'defaultRoom')

        setTimeout(done, 100)
      })

      afterAll((done) => {
        client1.destroy()
        client2.destroy()
        client3.destroy()
        setTimeout(done, 100)
      })

      it('all connections can join the default room and client #1 can see them', (done) => {
        client1.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).toBeNull()
          expect(data.room).toBe('defaultRoom')
          expect(data.membersCount).toBe(3)
          done()
        })
      })

      it('all connections can join the default room and client #2 can see them', (done) => {
        client2.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).toBeNull()
          expect(data.room).toBe('defaultRoom')
          expect(data.membersCount).toBe(3)
          done()
        })
      })

      it('all connections can join the default room and client #3 can see them', (done) => {
        client3.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).toBeNull()
          expect(data.room).toBe('defaultRoom')
          expect(data.membersCount).toBe(3)
          done()
        })
      })

      it('clients can communicate across the cluster', (done) => {
        client1.verbs('say', ['defaultRoom', 'Hi', 'from', 'client', '1'], () => {
          setTimeout(() => {
            var message = client2.messages[(client2.messages.length - 1)]
            expect(message.message).toBe('Hi from client 1')
            expect(message.room).toBe('defaultRoom')
            expect(message.from).toBe(client1.id)
            done()
          }, 100)
        })
      })
    })

    describe('shared cache', () => {
      it('peer 1 writes and peer 2 should read', (done) => {
        apiA.cache.save('test_key', 'yay', null, () => {
          apiB.cache.load('test_key', (error, value) => {
            expect(error).toBeNull()
            expect(value).toBe('yay')
            done()
          })
        })
      })

      it('peer 3 deletes and peer 1 cannot read any more', (done) => {
        apiC.cache.destroy('test_key', () => {
          apiA.cache.load('test_key', (error, value) => {
            expect(error.toString()).toBe('Error: Object not found')
            expect(value).toBeNull()
            done()
          })
        })
      })
    })

    describe('RPC', () => {
      beforeAll((done) => {
        setTimeout(done, 1000)
      })

      afterEach((done) => {
        delete apiA.rpcTestMethod
        delete apiB.rpcTestMethod
        delete apiC.rpcTestMethod
        done()
      })

      it('can call remote methods on all other servers in the cluster', (done) => {
        var data = {}

        apiA.rpcTestMethod = (arg1, arg2, next) => {
          data[1] = [arg1, arg2]; next()
        }
        apiB.rpcTestMethod = (arg1, arg2, next) => {
          data[2] = [arg1, arg2]; next()
        }
        apiC.rpcTestMethod = (arg1, arg2, next) => {
          data[3] = [arg1, arg2]; next()
        }

        process.nextTick(() => {
          apiA.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], null, (error) => {
            setTimeout(() => {
              expect(error).toBeFalsy()
              // callback should work too!
              expect(data[1][0]).toBe('arg1')
              expect(data[1][1]).toBe('arg2')
              expect(data[2][0]).toBe('arg1')
              expect(data[2][1]).toBe('arg2')
              expect(data[3][0]).toBe('arg1')
              expect(data[3][1]).toBe('arg2')
              done()
            }, 100)
          })
        })
      })

      it('can call remote methods only on one other cluster who holds a specific connectionId', (done) => {
        var client = new apiA.specHelper.Connection()

        var data = {}
        apiA.rpcTestMethod = (arg1, arg2, next) => {
          data[1] = [arg1, arg2]; next()
        }
        apiB.rpcTestMethod = (arg1, arg2, next) => {
          throw new Error('should not be here')
        }
        apiC.rpcTestMethod = (arg1, arg2, next) => {
          throw new Error('should not be here')
        }

        apiB.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id, (error) => {
          expect(error).toBeFalsy()
          expect(data[1][0]).toBe('arg1')
          expect(data[1][1]).toBe('arg2')
          client.destroy()
          done()
        })
      })

      it('can get information about connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()

        apiB.connections.apply(client.id, (connection) => {
          expect(connection.id).toBe(client.id)
          expect(connection.type).toBe('testServer')
          expect(connection.canChat).toBe(true)
          done()
        })
      })

      it('can call remote methods on/about connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.auth).toBeUndefined()

        apiB.connections.apply(client.id, 'set', ['auth', true], (connection) => {
          expect(connection.id).toBe(client.id)
          expect(client.auth).toBe(true)
          client.destroy()
          done()
        })
      })

      it('can send arbitraty messages to connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()

        apiB.connections.apply(client.id, 'sendMessage', {message: 'hi'}, (connection) => {
          var message = connection.messages[(connection.messages.length - 1)]
          expect(message.message).toBe('hi')

          done()
        })
      })

      it('failing RPC calls with a callback will have a failure callback', (done) => {
        apiB.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', (error) => {
          expect(error.toString()).toBe('Error: RPC Timeout')
          done()
        })
      })
    })

    describe('chat', () => {
      afterEach((done) => {
        apiA.chatRoom.destroy('newRoom', () => {
          done()
        })
      })

      it('can check if rooms exist', (done) => {
        apiA.chatRoom.exists('defaultRoom', (error, found) => {
          expect(error).toBeNull()
          expect(found).toBe(true)
          done()
        })
      })

      it('can check if a room does not exist', (done) => {
        apiA.chatRoom.exists('missingRoom', (error, found) => {
          expect(error).toBeNull()
          expect(found).toBe(false)
          done()
        })
      })

      it('server can create new room', (done) => {
        var room = 'newRoom'
        apiA.chatRoom.exists(room, (error, found) => {
          expect(error).toBeNull()
          expect(found).toBe(false)
          apiA.chatRoom.add(room, (error) => {
            expect(error).toBeNull()
            apiA.chatRoom.exists(room, (error, found) => {
              expect(error).toBeNull()
              expect(found).toBe(true)
              done()
            })
          })
        })
      })

      it('server cannot create already existing room', (done) => {
        apiA.chatRoom.add('defaultRoom', (error) => {
          expect(error.toString()).toBe('room exists')
          done()
        })
      })

      it('can enumerate all the rooms in the system', (done) => {
        apiA.chatRoom.add('defaultRoom', () => {
          apiA.chatRoom.add('newRoom', () => {
            apiA.chatRoom.list((error, rooms) => {
              expect(error).toBeNull()
              expect(rooms).toHaveLength(3);
              ['defaultRoom', 'newRoom', 'otherRoom'].forEach((r) => {
                expect(rooms.indexOf(r)).toBeGreaterThan(-1)
              })
              done()
            })
          })
        })
      })

      it('server can add connections to a LOCAL room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).toHaveLength(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          expect(didAdd).toBe(true)
          expect(client.rooms[0]).toBe('defaultRoom')
          client.destroy()
          done()
        })
      })

      it('server can add connections to a REMOTE room', (done) => {
        var client = new apiB.specHelper.Connection()
        expect(client.rooms).toHaveLength(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          expect(didAdd).toBe(true)
          expect(client.rooms).toHaveLength(1)
          expect(client.rooms[0]).toBe('defaultRoom')
          client.destroy()
          done()
        })
      })

      it('will not re-add a member to a room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).toHaveLength(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          expect(didAdd).toBe(true)
          apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
            expect(error.toString()).toBe('connection already in this room (defaultRoom)')
            expect(didAdd).toBe(false)
            client.destroy()
            done()
          })
        })
      })

      it('will not add a member to a non-existant room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).toHaveLength(0)
        apiA.chatRoom.addMember(client.id, 'newRoom', (error, didAdd) => {
          expect(error.toString()).toBe('room does not exist')
          expect(didAdd).toBe(false)
          client.destroy()
          done()
        })
      })

      it('server will not remove a member not in a room', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
          expect(error.toString()).toBe('connection not in this room (defaultRoom)')
          expect(didRemove).toBe(false)
          client.destroy()
          done()
        })
      })

      it('server can remove connections to a room (local)', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          expect(didAdd).toBe(true)
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
            expect(error).toBeNull()
            expect(didRemove).toBe(true)
            client.destroy()
            done()
          })
        })
      })

      it('server can remove connections to a room (remote)', (done) => {
        var client = new apiB.specHelper.Connection()
        apiB.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          expect(didAdd).toBe(true)
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
            expect(error).toBeNull()
            expect(didRemove).toBe(true)
            client.destroy()
            done()
          })
        })
      })

      it('server can destroy a room and connections will be removed', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.add('newRoom', (error) => {
          expect(error).toBeNull()
          apiA.chatRoom.addMember(client.id, 'newRoom', (error, didAdd) => {
            expect(error).toBeNull()
            expect(didAdd).toBe(true)
            expect(client.rooms[0]).toBe('newRoom')
            apiA.chatRoom.destroy('newRoom', (error) => {
              expect(error).toBeFalsy()
              expect(client.rooms).toHaveLength(0)
              // TODO: testing for the recepit of this message is a race condition with room.destroy and boradcast in test
              // client.messages[1].message.should.equal('this room has been deleted');
              // client.messages[1].room.should.equal('newRoom');
              client.destroy()
              done()
            })
          })
        })
      })

      it('can get a list of room members', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).toHaveLength(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).toBeNull()
          apiA.chatRoom.roomStatus('defaultRoom', (error, data) => {
            expect(error).toBeNull()
            expect(data.room).toBe('defaultRoom')
            expect(data.membersCount).toBe(1)
            client.destroy()
            done()
          })
        })
      })

      describe('chat middleware', () => {
        var clientA
        var clientB
        var originalGenerateMessagePayload

        beforeEach((done) => {
          originalGenerateMessagePayload = apiA.chatRoom.generateMessagePayload
          clientA = new apiA.specHelper.Connection()
          clientB = new apiA.specHelper.Connection()

          done()
        })

        afterEach((done) => {
          apiA.chatRoom.middleware = {}
          apiA.chatRoom.globalMiddleware = []

          clientA.destroy()
          clientB.destroy()

          apiA.chatRoom.generateMessagePayload = originalGenerateMessagePayload
          setTimeout(() => {
            done()
          }, 100)
        })

        it('generateMessagePayload can be overloaded', (done) => {
          apiA.chatRoom.generateMessagePayload = (message) => {
            return {
              thing: 'stuff',
              room: message.connection.room,
              from: message.connection.id
            }
          }

          clientA.verbs('roomAdd', 'defaultRoom', (error, data) => {
            expect(error).toBeFalsy()
            clientB.verbs('roomAdd', 'defaultRoom', (error, data) => {
              expect(error).toBeFalsy()
              clientA.verbs('say', ['defaultRoom', 'hi there'], (error, data) => {
                expect(error).toBeFalsy()
                setTimeout(() => {
                  var message = clientB.messages[(clientB.messages.length - 1)]
                  expect(message.thing).toBe('stuff')
                  expect(message.message).toBeFalsy()
                  done()
                }, 100)
              })
            })
          })
        })

        it('(join + leave) can add middleware to announce members', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'add chat middleware',
            join: function (connection, room, callback) {
              apiA.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, () => {
                callback()
              })
            }
          })

          apiA.chatRoom.addMiddleware({
            name: 'leave chat middleware',
            leave: function (connection, room, callback) {
              apiA.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, () => {
                callback()
              })
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', (error) => {
            expect(error).toBeNull()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).toBeNull()
              clientB.verbs('roomLeave', 'defaultRoom', (error) => {
                expect(error).toBeNull()

                setTimeout(() => {
                  expect(clientA.messages.pop().message).toBe('I have left the room: ' + clientB.id)
                  expect(clientA.messages.pop().message).toBe('I have entered the room: ' + clientB.id)

                  done()
                }, 100)
              })
            })
          })
        })

        it('(say) can modify message payloads', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: function (connection, room, messagePayload, callback) {
              if (messagePayload.from !== 0) {
                messagePayload.message = 'something else'
              }
              callback(null, messagePayload)
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', (error) => {
            expect(error).toBeNull()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).toBeNull()
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], (error) => {
                expect(error).toBeNull()

                setTimeout(() => {
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)]
                  expect(lastMessage.message).toBe('something else')

                  done()
                }, 100)
              })
            })
          })
        })

        it('can add middleware in a particular order and will be passed modified messagePayloads', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware 1',
            priority: 1000,
            say: function (connection, room, messagePayload, callback) {
              messagePayload.message = 'MIDDLEWARE 1'
              callback(null, messagePayload)
            }
          })

          apiA.chatRoom.addMiddleware({
            name: 'chat middleware 2',
            priority: 2000,
            say: function (connection, room, messagePayload, callback) {
              messagePayload.message = messagePayload.message + ' MIDDLEWARE 2'
              callback(null, messagePayload)
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', (error) => {
            expect(error).toBeNull()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).toBeNull()
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], (error) => {
                expect(error).toBeNull()
                setTimeout(() => {
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)]
                  expect(lastMessage.message).toBe('MIDDLEWARE 1 MIDDLEWARE 2')

                  done()
                }, 100)
              })
            })
          })
        })

        it('say middleware can block excecution', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            say: function (connection, room, messagePayload, callback) {
              callback(new Error('messages blocked'))
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', () => {
            clientB.verbs('roomAdd', 'defaultRoom', () => {
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], () => {
                setTimeout(() => {
                  // welcome message is passed, no join/leave/or say messages
                  expect(clientA.messages).toHaveLength(1)

                  done()
                }, 100)
              })
            })
          })
        })

        it('join middleware can block excecution', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            join: function (connection, room, callback) {
              callback(new Error('joining rooms blocked'))
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', (error, didJoin) => {
            expect(error.toString()).toBe('Error: joining rooms blocked')
            expect(didJoin).toBe(false)
            expect(clientA.rooms).toHaveLength(0)

            done()
          })
        })

        it('leave middleware can block excecution', (done) => {
          apiA.chatRoom.addMiddleware({
            name: 'chat middleware',
            leave: function (connection, room, callback) {
              callback(new Error('Hotel California'))
            }
          })

          clientA.verbs('roomAdd', 'defaultRoom', (error, didJoin) => {
            expect(error).toBeNull()
            expect(didJoin).toBe(true)
            expect(clientA.rooms).toHaveLength(1)
            expect(clientA.rooms[0]).toBe('defaultRoom')

            clientA.verbs('roomLeave', 'defaultRoom', (error, didLeave) => {
              expect(error.toString()).toBe('Error: Hotel California')
              expect(didLeave).toBe(false)
              expect(clientA.rooms).toHaveLength(1)

              done()
            })
          })
        })
      })
    })
  })
})
