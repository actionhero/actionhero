var should = require('should')
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
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      url = 'http://localhost:' + api.config.servers.web.port
      api.config.servers.websocket.clientUrl = 'http://localhost:' + api.config.servers.web.port

      connectClients(() => {
        done()
      })
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('socket client connections should work: client 1', (done) => {
    clientA.connect(function (error, data) {
      expect(error).toBeNull()
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 2', (done) => {
    clientB.connect(function (error, data) {
      expect(error).toBeNull()
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 3', (done) => {
    clientC.connect(function (error, data) {
      expect(error).toBeNull()
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      clientA.welcomeMessage.should.equal('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('I can get my connection details', (done) => {
    clientA.detailsView((response) => {
      response.data.connectedAt.should.be.within(0, new Date().getTime())
      response.data.remoteIP.should.equal('127.0.0.1')
      done()
    })
  })

  it('can run actions with errors', (done) => {
    clientA.action('cacheTest', (response) => {
      response.error.should.equal('key is a required parameter for this action')
      done()
    })
  })

  it('can run actions properly', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      should.not.exist(response.error)
      done()
    })
  })

  it('does not have sticky params', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      should.not.exist(response.error)
      response.cacheTestResults.loadResp.key.should.equal('cacheTest_test key')
      response.cacheTestResults.loadResp.value.should.equal('test value')
      clientA.action('cacheTest', (response) => {
        response.error.should.equal('key is a required parameter for this action')
        done()
      })
    })
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
      responses.length.should.equal(6)
      for (var i in responses) {
        var response = responses[i]
        if (i === 0 || i === '0') {
          response.error.should.eql('you have too many pending requests')
        } else {
          should.not.exist(response.error)
        }
      }
      done()
    }, 1000)
  })

  describe('files', () => {
    it('can request file data', (done) => {
      clientA.file('simple.html', function (data) {
        should.not.exist(data.error)
        data.content.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        data.mime.should.equal('text/html')
        data.length.should.equal(101)
        done()
      })
    })

    it('missing files', (done) => {
      clientA.file('missing.html', function (data) {
        data.error.should.equal('That file is not found')
        data.mime.should.equal('text/html')
        should.not.exist(data.content)
        done()
      })
    })
  })

  describe('chat', () => {
    beforeAll((done) => {
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
        join: function (connection, room, callback) {
          api.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, function (e) {
            callback()
          })
        }
      })

      api.chatRoom.addMiddleware({
        name: 'leave chat middleware',
        leave: function (connection, room, callback) {
          api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, function (e) {
            callback()
          })
        }
      })

      done()
    })

    afterAll((done) => {
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
          should.not.exist(response.error)
          response.data.rooms[0].should.equal('defaultRoom')
          response.data.rooms[1].should.equal('otherRoom')
          clientA.roomView('otherRoom', (response) => {
            response.data.membersCount.should.equal(1)
            done()
          })
        })
      })
    })

    it('will update client room info when they change rooms', (done) => {
      clientA.rooms[0].should.equal('defaultRoom')
      should.not.exist(clientA.rooms[1])
      clientA.roomAdd('otherRoom', (response) => {
        should.not.exist(response.error)
        clientA.rooms[0].should.equal('defaultRoom')
        clientA.rooms[1].should.equal('otherRoom')
        clientA.roomLeave('defaultRoom', (response) => {
          should.not.exist(response.error)
          clientA.rooms[0].should.equal('otherRoom')
          should.not.exist(clientA.rooms[1])
          done()
        })
      })
    })

    it('Clients can talk to each other', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        response.context.should.equal('user')
        response.message.should.equal('hello from client 2')
        done()
      }

      clientA.on('say', listener)
      clientB.say('defaultRoom', 'hello from client 2')
    })

    it('The client say method does not rely on order', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        response.context.should.equal('user')
        response.message.should.equal('hello from client 2')
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
        response.context.should.equal('user')
        response.message.should.equal('I have entered the room: ' + clientB.id)
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
        response.context.should.equal('user')
        response.message.should.equal('I have left the room: ' + clientB.id)
        done()
      }

      clientA.on('say', listener)
      clientB.roomLeave('defaultRoom')
    })

    it('will not get messages for rooms I am not in', (done) => {
      clientB.roomAdd('otherRoom', (response) => {
        should.not.exist(response.error)
        clientB.rooms.length.should.equal(2)

        var listener = (response) => {
          clientC.removeListener('say', listener)
          should.not.exist(response)
        }

        clientC.rooms.length.should.equal(1)
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
        response.data.membersCount.should.equal(3)
        clientB.roomLeave('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            response.data.membersCount.should.equal(2)
            done()
          })
        })
      })
    })

    describe('middleware - say and onSayReceive', () => {
      beforeAll((done) => {
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

      afterAll((done) => {
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
          response.message.should.equal('Test Message - To: ' + clientA.id) // clientA.id (Receiever)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          response.message.should.equal('Test Message - To: ' + clientB.id) // clientB.id (Receiever)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          response.message.should.equal('Test Message - To: ' + clientC.id) // clientC.id (Receiever)
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
          messagesReceived.should.equal(7)
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
          response.message.should.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          response.message.should.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          response.message.should.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
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

      beforeAll((done) => {
        // Ensure that default behavior works
        clientA.roomAdd('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')

            for (var key in response.data.members) {
              (response.data.members[key].type === undefined).should.eql(true)
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

      afterAll((done) => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate

        // Check that everything is back to normal
        clientA.roomAdd('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')
            for (var key in response.data.members) {
              (response.data.members[key].type === undefined).should.eql(true)
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
            response.data.room.should.equal('defaultRoom')
            for (var key in response.data.members) {
              response.data.members[key].type.should.eql('websocket')
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

    beforeAll(() => {
      originalSimultaneousActions = api.config.general.simultaneousActions
      api.config.general.simultaneousActions = 99999999
    })

    afterAll(() => {
      api.config.general.simultaneousActions = originalSimultaneousActions
    })

    it('will not have param colisions', (done) => {
      var completed = 0
      var started = 0
      var sleeps = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]

      var toComplete = function (sleep, response) {
        sleep.should.equal(response.sleepDuration)
        completed++
        if (completed === started) {
          done()
        }
      }

      sleeps.forEach(function (sleep) {
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
      api.servers.servers.websocket.connections().length.should.equal(3)
      clientA.disconnect()
      clientB.disconnect()
      clientC.disconnect()
      setTimeout(() => {
        api.servers.servers.websocket.connections().length.should.equal(0)
        done()
      }, 500)
    })

    it('can be sent disconnect events from the server', (done) => {
      clientA.detailsView((response) => {
        response.data.remoteIP.should.equal('127.0.0.1')

        var count = 0
        for (var id in api.connections.connections) {
          count++
          api.connections.connections[id].destroy()
        }
        count.should.equal(3)

        clientA.detailsView(() => {
          throw new Error('should not get response')
        })

        setTimeout(done, 500)
      })
    })
  })
})
