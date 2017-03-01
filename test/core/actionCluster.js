'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

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
    expect(error).to.be.null()
    actionhero2.start({configChanges: configChanges[2]}, (error, a2) => {
      expect(error).to.be.null()
      actionhero3.start({configChanges: configChanges[3]}, (error, a3) => {
        expect(error).to.be.null()
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
    before((done) => {
      startAllServers(done)
    })

    after((done) => {
      stopAllServers(done)
    })

    describe('say and clients on separate servers', () => {
      var client1
      var client2
      var client3

      before((done) => {
        client1 = new apiA.specHelper.Connection()
        client2 = new apiB.specHelper.Connection()
        client3 = new apiC.specHelper.Connection()

        client1.verbs('roomAdd', 'defaultRoom')
        client2.verbs('roomAdd', 'defaultRoom')
        client3.verbs('roomAdd', 'defaultRoom')

        setTimeout(done, 100)
      })

      after((done) => {
        client1.destroy()
        client2.destroy()
        client3.destroy()
        setTimeout(done, 100)
      })

      it('all connections can join the default room and client #1 can see them', (done) => {
        client1.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).to.be.null()
          expect(data.room).to.equal('defaultRoom')
          expect(data.membersCount).to.equal(3)
          done()
        })
      })

      it('all connections can join the default room and client #2 can see them', (done) => {
        client2.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).to.be.null()
          expect(data.room).to.equal('defaultRoom')
          expect(data.membersCount).to.equal(3)
          done()
        })
      })

      it('all connections can join the default room and client #3 can see them', (done) => {
        client3.verbs('roomView', 'defaultRoom', (error, data) => {
          expect(error).to.be.null()
          expect(data.room).to.equal('defaultRoom')
          expect(data.membersCount).to.equal(3)
          done()
        })
      })

      it('clients can communicate across the cluster', (done) => {
        client1.verbs('say', ['defaultRoom', 'Hi', 'from', 'client', '1'], () => {
          setTimeout(() => {
            var message = client2.messages[(client2.messages.length - 1)]
            expect(message.message).to.equal('Hi from client 1')
            expect(message.room).to.equal('defaultRoom')
            expect(message.from).to.equal(client1.id)
            done()
          }, 100)
        })
      })
    })

    describe('shared cache', () => {
      it('peer 1 writes and peer 2 should read', (done) => {
        apiA.cache.save('test_key', 'yay', null, () => {
          apiB.cache.load('test_key', (error, value) => {
            expect(error).to.be.null()
            expect(value).to.equal('yay')
            done()
          })
        })
      })

      it('peer 3 deletes and peer 1 cannot read any more', (done) => {
        apiC.cache.destroy('test_key', () => {
          apiA.cache.load('test_key', (error, value) => {
            expect(error.toString()).to.equal('Error: Object not found')
            expect(value).to.be.null()
            done()
          })
        })
      })
    })

    describe('RPC', () => {
      before((done) => {
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
              expect(error).to.not.exist()
              // callback should work too!
              expect(data[1][0]).to.equal('arg1')
              expect(data[1][1]).to.equal('arg2')
              expect(data[2][0]).to.equal('arg1')
              expect(data[2][1]).to.equal('arg2')
              expect(data[3][0]).to.equal('arg1')
              expect(data[3][1]).to.equal('arg2')
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
          expect(error).to.not.exist()
          expect(data[1][0]).to.equal('arg1')
          expect(data[1][1]).to.equal('arg2')
          client.destroy()
          done()
        })
      })

      it('can get information about connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()

        apiB.connections.apply(client.id, (connection) => {
          expect(connection.id).to.equal(client.id)
          expect(connection.type).to.equal('testServer')
          expect(connection.canChat).to.equal(true)
          done()
        })
      })

      it('can call remote methods on/about connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.auth).to.not.exist()

        apiB.connections.apply(client.id, 'set', ['auth', true], (connection) => {
          expect(connection.id).to.equal(client.id)
          expect(client.auth).to.equal(true)
          client.destroy()
          done()
        })
      })

      it('can send arbitraty messages to connections connected to other servers', (done) => {
        var client = new apiA.specHelper.Connection()

        apiB.connections.apply(client.id, 'sendMessage', {message: 'hi'}, (connection) => {
          var message = connection.messages[(connection.messages.length - 1)]
          expect(message.message).to.equal('hi')

          done()
        })
      })

      it('failing RPC calls with a callback will have a failure callback', (done) => {
        apiB.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', (error) => {
          expect(error.toString()).to.equal('Error: RPC Timeout')
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
          expect(error).to.be.null()
          expect(found).to.equal(true)
          done()
        })
      })

      it('can check if a room does not exist', (done) => {
        apiA.chatRoom.exists('missingRoom', (error, found) => {
          expect(error).to.be.null()
          expect(found).to.equal(false)
          done()
        })
      })

      it('server can create new room', (done) => {
        var room = 'newRoom'
        apiA.chatRoom.exists(room, (error, found) => {
          expect(error).to.be.null()
          expect(found).to.equal(false)
          apiA.chatRoom.add(room, (error) => {
            expect(error).to.be.null()
            apiA.chatRoom.exists(room, (error, found) => {
              expect(error).to.be.null()
              expect(found).to.equal(true)
              done()
            })
          })
        })
      })

      it('server cannot create already existing room', (done) => {
        apiA.chatRoom.add('defaultRoom', (error) => {
          expect(error.toString()).to.equal('room exists')
          done()
        })
      })

      it('can enumerate all the rooms in the system', (done) => {
        apiA.chatRoom.add('defaultRoom', () => {
          apiA.chatRoom.add('newRoom', () => {
            apiA.chatRoom.list((error, rooms) => {
              expect(error).to.be.null()
              expect(rooms).to.have.length(3);
              ['defaultRoom', 'newRoom', 'otherRoom'].forEach((r) => {
                expect(rooms.indexOf(r)).to.be.above(-1)
              })
              done()
            })
          })
        })
      })

      it('server can add connections to a LOCAL room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).to.have.length(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          expect(didAdd).to.equal(true)
          expect(client.rooms[0]).to.equal('defaultRoom')
          client.destroy()
          done()
        })
      })

      it('server can add connections to a REMOTE room', (done) => {
        var client = new apiB.specHelper.Connection()
        expect(client.rooms).to.have.length(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          expect(didAdd).to.equal(true)
          expect(client.rooms).to.have.length(1)
          expect(client.rooms[0]).to.equal('defaultRoom')
          client.destroy()
          done()
        })
      })

      it('will not re-add a member to a room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).to.have.length(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          expect(didAdd).to.equal(true)
          apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
            expect(error.toString()).to.equal('connection already in this room (defaultRoom)')
            expect(didAdd).to.equal(false)
            client.destroy()
            done()
          })
        })
      })

      it('will not add a member to a non-existant room', (done) => {
        var client = new apiA.specHelper.Connection()
        expect(client.rooms).to.have.length(0)
        apiA.chatRoom.addMember(client.id, 'newRoom', (error, didAdd) => {
          expect(error.toString()).to.equal('room does not exist')
          expect(didAdd).to.equal(false)
          client.destroy()
          done()
        })
      })

      it('server will not remove a member not in a room', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
          expect(error.toString()).to.equal('connection not in this room (defaultRoom)')
          expect(didRemove).to.equal(false)
          client.destroy()
          done()
        })
      })

      it('server can remove connections to a room (local)', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          expect(didAdd).to.equal(true)
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
            expect(error).to.be.null()
            expect(didRemove).to.equal(true)
            client.destroy()
            done()
          })
        })
      })

      it('server can remove connections to a room (remote)', (done) => {
        var client = new apiB.specHelper.Connection()
        apiB.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          expect(didAdd).to.equal(true)
          apiA.chatRoom.removeMember(client.id, 'defaultRoom', (error, didRemove) => {
            expect(error).to.be.null()
            expect(didRemove).to.equal(true)
            client.destroy()
            done()
          })
        })
      })

      it('server can destroy a room and connections will be removed', (done) => {
        var client = new apiA.specHelper.Connection()
        apiA.chatRoom.add('newRoom', (error) => {
          expect(error).to.be.null()
          apiA.chatRoom.addMember(client.id, 'newRoom', (error, didAdd) => {
            expect(error).to.be.null()
            expect(didAdd).to.equal(true)
            expect(client.rooms[0]).to.equal('newRoom')
            apiA.chatRoom.destroy('newRoom', (error) => {
              expect(error).to.not.exist()
              expect(client.rooms).to.have.length(0)
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
        expect(client.rooms).to.have.length(0)
        apiA.chatRoom.addMember(client.id, 'defaultRoom', (error, didAdd) => {
          expect(error).to.be.null()
          apiA.chatRoom.roomStatus('defaultRoom', (error, data) => {
            expect(error).to.be.null()
            expect(data.room).to.equal('defaultRoom')
            expect(data.membersCount).to.equal(1)
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
            expect(error).to.not.exist()
            clientB.verbs('roomAdd', 'defaultRoom', (error, data) => {
              expect(error).to.not.exist()
              clientA.verbs('say', ['defaultRoom', 'hi there'], (error, data) => {
                expect(error).to.not.exist()
                setTimeout(() => {
                  var message = clientB.messages[(clientB.messages.length - 1)]
                  expect(message.thing).to.equal('stuff')
                  expect(message.message).to.not.exist()
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
            expect(error).to.be.null()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).to.be.null()
              clientB.verbs('roomLeave', 'defaultRoom', (error) => {
                expect(error).to.be.null()

                setTimeout(() => {
                  expect(clientA.messages.pop().message).to.equal('I have left the room: ' + clientB.id)
                  expect(clientA.messages.pop().message).to.equal('I have entered the room: ' + clientB.id)

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
            expect(error).to.be.null()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).to.be.null()
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], (error) => {
                expect(error).to.be.null()

                setTimeout(() => {
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)]
                  expect(lastMessage.message).to.equal('something else')

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
            expect(error).to.be.null()
            clientB.verbs('roomAdd', 'defaultRoom', (error) => {
              expect(error).to.be.null()
              clientB.verbs('say', ['defaultRoom', 'something', 'awesome'], (error) => {
                expect(error).to.be.null()
                setTimeout(() => {
                  var lastMessage = clientA.messages[(clientA.messages.length - 1)]
                  expect(lastMessage.message).to.equal('MIDDLEWARE 1 MIDDLEWARE 2')

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
                  expect(clientA.messages).to.have.length(1)

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
            expect(error.toString()).to.equal('Error: joining rooms blocked')
            expect(didJoin).to.equal(false)
            expect(clientA.rooms).to.have.length(0)

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
            expect(error).to.be.null()
            expect(didJoin).to.equal(true)
            expect(clientA.rooms).to.have.length(1)
            expect(clientA.rooms[0]).to.equal('defaultRoom')

            clientA.verbs('roomLeave', 'defaultRoom', (error, didLeave) => {
              expect(error.toString()).to.equal('Error: Hotel California')
              expect(didLeave).to.equal(false)
              expect(clientA.rooms).to.have.length(1)

              done()
            })
          })
        })
      })
    })
  })
})
