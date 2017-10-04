var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

var path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var clientA
var clientB
var clientC

var url

var connectClients = function (callback) {
  // get actionheroClient in scope
  // TODO: Perhaps we read this from disk after server boot.
  eval(api.servers.servers.websocket.compileActionheroClientJS()) // eslint-disable-line

  var S = api.servers.servers.websocket.server.Socket
  url = 'http://localhost:' + api.config.servers.web.port
  var clientAsocket = new S(url)
  var clientBsocket = new S(url)
  var clientCsocket = new S(url)

  clientA = new ActionheroClient({}, clientAsocket) // eslint-disable-line
  clientB = new ActionheroClient({}, clientBsocket) // eslint-disable-line
  clientC = new ActionheroClient({}, clientCsocket) // eslint-disable-line

  setTimeout(() => {
    callback()
  }, 100)
}

describe('Server: Web Socket', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port

      connectClients(() => {
        done()
      })
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('socket client connections should work: client 1', (done) => {
    clientA.connect((error, data) => {
      expect(error).to.be.null()
      expect(data.context).to.equal('response')
      expect(data.data.totalActions).to.equal(0)
      expect(clientA.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 2', (done) => {
    clientB.connect((error, data) => {
      expect(error).to.be.null()
      expect(data.context).to.equal('response')
      expect(data.data.totalActions).to.equal(0)
      expect(clientA.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 3', (done) => {
    clientC.connect((error, data) => {
      expect(error).to.be.null()
      expect(data.context).to.equal('response')
      expect(data.data.totalActions).to.equal(0)
      expect(clientA.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('I can get my connection details', (done) => {
    clientA.detailsView((response) => {
      expect(response.data.connectedAt).to.be.below(new Date().getTime())
      expect(response.data.remoteIP).to.equal('127.0.0.1')
      done()
    })
  })

  it('can run actions with errors', (done) => {
    clientA.action('cacheTest', (response) => {
      expect(response.error).to.equal('key is a required parameter for this action')
      done()
    })
  })

  it('can run actions properly', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      expect(response.error).to.not.exist()
      done()
    })
  })

  it('does not have sticky params', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      expect(response.error).to.not.exist()
      expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_test key')
      expect(response.cacheTestResults.loadResp.value).to.equal('test value')
      clientA.action('cacheTest', (response) => {
        expect(response.error).to.equal('key is a required parameter for this action')
        done()
      })
    })
  })

  it('properly responds with messageCount', (done) => {
    var verbResponse = false
    var actionResponse = false
    var verbMsgCount = false
    var actionMsgCount = false
    clientA.roomAdd('defaultRoom', (response) => {
      verbResponse = true
      verbMsgCount = response.messageCount
      if (actionResponse) {
        expect(actionMsgCount).to.not.equal(verbMsgCount)
        done()
      }
    })
    clientA.action('sleepTest', {sleepDuration: 100}, (response) => {
      actionResponse = true
      actionMsgCount = response.messageCount
      if (verbResponse) {
        expect(verbMsgCount).to.not.equal(actionResponse)
        done()
      }
    })
    setTimeout(() => {
      if (!actionResponse && !verbResponse) {
        done('Not all responses received')
      }
    }, 2000)
  })

  it('will limit how many simultaneous connections I can have', (done) => {
    var responses = []
    clientA.action('sleepTest', {sleepDuration: 100}, (response) => { responses.push(response) })
    clientA.action('sleepTest', {sleepDuration: 200}, (response) => { responses.push(response) })
    clientA.action('sleepTest', {sleepDuration: 300}, (response) => { responses.push(response) })
    clientA.action('sleepTest', {sleepDuration: 400}, (response) => { responses.push(response) })
    clientA.action('sleepTest', {sleepDuration: 500}, (response) => { responses.push(response) })
    clientA.action('sleepTest', {sleepDuration: 600}, (response) => { responses.push(response) })

    setTimeout(() => {
      expect(responses).to.have.length(6)
      for (var i in responses) {
        var response = responses[i]
        if (i === 0 || i === '0') {
          expect(response.error).to.equal('you have too many pending requests')
        } else {
          expect(response.error).to.not.exist()
        }
      }
      done()
    }, 1000)
  })

  describe('files', () => {
    it('can request file data', (done) => {
      clientA.file('simple.html', (data) => {
        expect(data.error).to.be.null()
        expect(data.content).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        expect(data.mime).to.equal('text/html')
        expect(data.length).to.equal(101)
        done()
      })
    })

    it('missing files', (done) => {
      clientA.file('missing.html', (data) => {
        expect(data.error).to.equal('That file is not found')
        expect(data.mime).to.equal('text/html')
        expect(data.content).to.be.null()
        done()
      })
    })
  })

  describe('chat', () => {
    before((done) => {
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
        join: function (connection, room, callback) {
          api.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, (e) => {
            callback()
          })
        }
      })

      api.chatRoom.addMiddleware({
        name: 'leave chat middleware',
        leave: function (connection, room, callback) {
          api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, (e) => {
            callback()
          })
        }
      })

      done()
    })

    after((done) => {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []

      done()
    })

    beforeEach((done) => {
      clientA.roomAdd('defaultRoom', () => {
        clientB.roomAdd('defaultRoom', () => {
          clientC.roomAdd('defaultRoom', () => {
            setTimeout(() => { // timeout to skip welcome messages as clients join rooms
              done()
            }, 100)
          })
        })
      })
    })

    afterEach((done) => {
      clientA.roomLeave('defaultRoom', () => {
        clientB.roomLeave('defaultRoom', () => {
          clientC.roomLeave('defaultRoom', () => {
            clientA.roomLeave('otherRoom', () => {
              clientB.roomLeave('otherRoom', () => {
                clientC.roomLeave('otherRoom', () => {
                  done()
                })
              })
            })
          })
        })
      })
    })

    it('can change rooms and get room details', (done) => {
      clientA.roomAdd('otherRoom', () => {
        clientA.detailsView((response) => {
          expect(response.error).to.not.exist()
          expect(response.data.rooms[0]).to.equal('defaultRoom')
          expect(response.data.rooms[1]).to.equal('otherRoom')
          clientA.roomView('otherRoom', (response) => {
            expect(response.data.membersCount).to.equal(1)
            done()
          })
        })
      })
    })

    it('will update client room info when they change rooms', (done) => {
      expect(clientA.rooms[0]).to.equal('defaultRoom')
      expect(clientA.rooms[1]).to.not.exist()
      clientA.roomAdd('otherRoom', (response) => {
        expect(response.error).to.not.exist()
        expect(clientA.rooms[0]).to.equal('defaultRoom')
        expect(clientA.rooms[1]).to.equal('otherRoom')
        clientA.roomLeave('defaultRoom', (response) => {
          expect(response.error).to.not.exist()
          expect(clientA.rooms[0]).to.equal('otherRoom')
          expect(clientA.rooms[1]).to.not.exist()
          done()
        })
      })
    })

    it('Clients can talk to each other', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).to.equal('user')
        expect(response.message).to.equal('hello from client 2')
        done()
      }

      clientA.on('say', listener)
      clientB.say('defaultRoom', 'hello from client 2')
    })

    it('The client say method does not rely on order', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).to.equal('user')
        expect(response.message).to.equal('hello from client 2')
        done()
      }

      clientB.say = function (room, message, callback) {
        this.send({message: message, room: room, event: 'say'}, callback)
      }

      clientA.on('say', listener)
      clientB.say('defaultRoom', 'hello from client 2')
    })

    it('connections are notified when I join a room', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).to.equal('user')
        expect(response.message).to.equal('I have entered the room: ' + clientB.id)
        done()
      }

      clientA.roomAdd('otherRoom', () => {
        clientA.on('say', listener)
        clientB.roomAdd('otherRoom')
      })
    })

    it('connections are notified when I leave a room', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).to.equal('user')
        expect(response.message).to.equal('I have left the room: ' + clientB.id)
        done()
      }

      clientA.on('say', listener)
      clientB.roomLeave('defaultRoom')
    })

    it('will not get messages for rooms I am not in', (done) => {
      clientB.roomAdd('otherRoom', (response) => {
        expect(response.error).to.not.exist()
        expect(clientB.rooms.length).to.equal(2)

        var listener = (response) => {
          clientC.removeListener('say', listener)
          expect(response).to.not.exist()
        }

        expect(clientC.rooms.length).to.equal(1)
        clientC.on('say', listener)

        setTimeout(() => {
          clientC.removeListener('say', listener)
          done()
        }, 1000)

        clientB.say('otherRoom', 'you should not hear this')
      })
    })

    it('connections can see member counts changing within rooms as folks join and leave', (done) => {
      clientA.roomView('defaultRoom', (response) => {
        expect(response.data.membersCount).to.equal(3)
        clientB.roomLeave('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            expect(response.data.membersCount).to.equal(2)
            done()
          })
        })
      })
    })

    describe('middleware - say and onSayReceive', () => {
      before((done) => {
        clientA.roomAdd('defaultRoom', () => {
          clientB.roomAdd('defaultRoom', () => {
            clientC.roomAdd('defaultRoom', () => {
              setTimeout(() => { // timeout to skip welcome messages as clients join rooms
                done()
              }, 100)
            })
          })
        })
      })

      after((done) => {
        clientA.roomLeave('defaultRoom', () => {
          clientB.roomLeave('defaultRoom', () => {
            clientC.roomLeave('defaultRoom', () => {
              done()
            })
          })
        })
      })

      afterEach((done) => {
        api.chatRoom.middleware = {}
        api.chatRoom.globalMiddleware = []

        done()
      })

      it('each listener receive custom message', (done) => {
        api.chatRoom.addMiddleware({
          name: 'say for each',
          say: function (connection, room, messagePayload, callback) {
            messagePayload.message += ' - To: ' + connection.id
            callback(null, messagePayload)
          }
        })

        var listenerA = (response) => {
          clientA.removeListener('say', listenerA)
          expect(response.message).to.equal('Test Message - To: ' + clientA.id) // clientA.id (Receiever)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Receiever)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          expect(response.message).to.equal('Test Message - To: ' + clientC.id) // clientC.id (Receiever)
        }

        clientA.on('say', listenerA)
        clientB.on('say', listenerB)
        clientC.on('say', listenerC)
        clientB.say('defaultRoom', 'Test Message')

        setTimeout(() => {
          clientA.removeListener('say', listenerA)
          clientB.removeListener('say', listenerB)
          clientC.removeListener('say', listenerC)
          done()
        }, 1000)
      })

      it('only one message should be received per connection', (done) => {
        var firstSayCall = true
        api.chatRoom.addMiddleware({
          name: 'first say middleware',
          say: function (connection, room, messagePayload, callback) {
            if (firstSayCall) {
              firstSayCall = false
              setTimeout(() => {
                callback()
              }, 200)
            } else {
              callback()
            }
          }
        })

        var messagesReceived = 0
        var listenerA = (response) => {
          messagesReceived += 1
        }

        var listenerB = (response) => {
          messagesReceived += 2
        }

        var listenerC = (response) => {
          messagesReceived += 4
        }

        clientA.on('say', listenerA)
        clientB.on('say', listenerB)
        clientC.on('say', listenerC)
        clientB.say('defaultRoom', 'Test Message')

        setTimeout(() => {
          clientA.removeListener('say', listenerA)
          clientB.removeListener('say', listenerB)
          clientC.removeListener('say', listenerC)
          expect(messagesReceived).to.equal(7)
          done()
        }, 1000)
      })

      it('each listener receive same custom message', (done) => {
        api.chatRoom.addMiddleware({
          name: 'say for each',
          onSayReceive: function (connection, room, messagePayload, callback) {
            messagePayload.message += ' - To: ' + connection.id
            callback(null, messagePayload)
          }
        })

        var listenerA = (response) => {
          clientA.removeListener('say', listenerA)
          expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        clientA.on('say', listenerA)
        clientB.on('say', listenerB)
        clientC.on('say', listenerC)
        clientB.say('defaultRoom', 'Test Message')

        setTimeout(() => {
          clientA.removeListener('say', listenerA)
          clientB.removeListener('say', listenerB)
          clientC.removeListener('say', listenerC)
          done()
        }, 1000)
      })
    })

    describe('custom room member data', () => {
      var currentSanitize
      var currentGenerate

      before((done) => {
        // Ensure that default behavior works
        clientA.roomAdd('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')

            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.not.exist()
            }

            // save off current functions
            currentSanitize = api.chatRoom.sanitizeMemberDetails
            currentGenerate = api.chatRoom.generateMemberDetails

            // override functions
            api.chatRoom.sanitizeMemberDetails = function (data) {
              return {
                id: data.id,
                joinedAt: data.joinedAt,
                type: data.type
              }
            }

            api.chatRoom.generateMemberDetails = function (connection) {
              return {
                id: connection.id,
                joinedAt: new Date().getTime(),
                type: connection.type
              }
            }

            clientA.roomLeave('defaultRoom', () => {
              done()
            })
          })
        })
      })

      after((done) => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate

        // Check that everything is back to normal
        clientA.roomAdd('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.not.exist()
            }
            setTimeout(() => {
              clientA.roomLeave('defaultRoom', () => {
                done()
              })
            }, 100)
          })
        })
      })

      it('should view non-default member data', (done) => {
        clientA.roomAdd('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.equal('websocket')
            }
            clientA.roomLeave('defaultRoom')
            done()
          })
        })
      })
    })
  })

  describe('param collisions', () => {
    var originalSimultaneousActions

    before(() => {
      originalSimultaneousActions = api.config.general.simultaneousActions
      api.config.general.simultaneousActions = 99999999
    })

    after(() => {
      api.config.general.simultaneousActions = originalSimultaneousActions
    })

    it('will not have param colisions', (done) => {
      var completed = 0
      var started = 0
      var sleeps = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]

      var toComplete = function (sleep, response) {
        expect(sleep).to.equal(response.sleepDuration)
        completed++
        if (completed === started) {
          done()
        }
      }

      sleeps.forEach((sleep) => {
        started++
        clientA.action('sleepTest', {sleepDuration: sleep}, (response) => { toComplete(sleep, response) })
      })
    })
  })

  describe('disconnect', () => {
    beforeEach((done) => {
      try {
        clientA.disconnect()
        clientB.disconnect()
        clientC.disconnect()
      } catch (e) {}

      connectClients(() => {
        clientA.connect()
        clientB.connect()
        clientC.connect()
        setTimeout(done, 500)
      })
    })

    it('client can disconnect', (done) => {
      expect(api.servers.servers.websocket.connections().length).to.equal(3)
      clientA.disconnect()
      clientB.disconnect()
      clientC.disconnect()
      setTimeout(() => {
        expect(api.servers.servers.websocket.connections().length).to.equal(0)
        done()
      }, 500)
    })

    it('can be sent disconnect events from the server', (done) => {
      clientA.detailsView((response) => {
        expect(response.data.remoteIP).to.equal('127.0.0.1')

        var count = 0
        for (var id in api.connections.connections) {
          count++
          api.connections.connections[id].destroy()
        }
        expect(count).to.equal(3)

        clientA.detailsView(() => {
          throw new Error('should not get response')
        })

        setTimeout(done, 500)
      })
    })
  })
})
