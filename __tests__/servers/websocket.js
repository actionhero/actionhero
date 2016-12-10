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
    clientA.connect((error, data) => {
      expect(error).toBeNull()
      expect(data.context).toBe('response')
      expect(data.data.totalActions).toBe(0)
      expect(clientA.welcomeMessage).toBe('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 2', (done) => {
    clientB.connect((error, data) => {
      expect(error).toBeNull()
      expect(data.context).toBe('response')
      expect(data.data.totalActions).toBe(0)
      expect(clientA.welcomeMessage).toBe('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('socket client connections should work: client 3', (done) => {
    clientC.connect((error, data) => {
      expect(error).toBeNull()
      expect(data.context).toBe('response')
      expect(data.data.totalActions).toBe(0)
      expect(clientA.welcomeMessage).toBe('Hello! Welcome to the actionhero api')
      done()
    })
  })

  it('I can get my connection details', (done) => {
    clientA.detailsView((response) => {
      expect(response.data.connectedAt).toBeLessThan(new Date().getTime())
      expect(response.data.remoteIP).toBe('127.0.0.1')
      done()
    })
  })

  it('can run actions with errors', (done) => {
    clientA.action('cacheTest', (response) => {
      expect(response.error).toBe('key is a required parameter for this action')
      done()
    })
  })

  it('can run actions properly', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      expect(response.error).toBeUndefined()
      done()
    })
  })

  it('does not have sticky params', (done) => {
    clientA.action('cacheTest', {key: 'test key', value: 'test value'}, (response) => {
      expect(response.error).toBeUndefined()
      expect(response.cacheTestResults.loadResp.key).toBe('cacheTest_test key')
      expect(response.cacheTestResults.loadResp.value).toBe('test value')
      clientA.action('cacheTest', (response) => {
        expect(response.error).toBe('key is a required parameter for this action')
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
      expect(responses).toHaveLength(6)
      for (var i in responses) {
        var response = responses[i]
        if (i === 0 || i === '0') {
          expect(response.error).toBe('you have too many pending requests')
        } else {
          expect(response.error).toBeUndefined()
        }
      }
      done()
    }, 1000)
  })

  describe('files', () => {
    it('can request file data', (done) => {
      clientA.file('simple.html', (data) => {
        expect(data.error).toBeNull()
        expect(data.content).toBe('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        expect(data.mime).toBe('text/html')
        expect(data.length).toBe(101)
        done()
      })
    })

    it('missing files', (done) => {
      clientA.file('missing.html', (data) => {
        expect(data.error).toBe('That file is not found')
        expect(data.mime).toBe('text/html')
        expect(data.content).toBeNull()
        done()
      })
    })
  })

  describe('chat', () => {
    beforeAll((done) => {
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
          expect(response.error).toBeUndefined()
          expect(response.data.rooms[0]).toBe('defaultRoom')
          expect(response.data.rooms[1]).toBe('otherRoom')
          clientA.roomView('otherRoom', (response) => {
            expect(response.data.membersCount).toBe(1)
            done()
          })
        })
      })
    })

    it('will update client room info when they change rooms', (done) => {
      expect(clientA.rooms[0]).toBe('defaultRoom')
      expect(clientA.rooms[1]).toBeUndefined()
      clientA.roomAdd('otherRoom', (response) => {
        expect(response.error).toBeUndefined()
        expect(clientA.rooms[0]).toBe('defaultRoom')
        expect(clientA.rooms[1]).toBe('otherRoom')
        clientA.roomLeave('defaultRoom', (response) => {
          expect(response.error).toBeUndefined()
          expect(clientA.rooms[0]).toBe('otherRoom')
          expect(clientA.rooms[1]).toBeUndefined()
          done()
        })
      })
    })

    it('Clients can talk to each other', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).toBe('user')
        expect(response.message).toBe('hello from client 2')
        done()
      }

      clientA.on('say', listener)
      clientB.say('defaultRoom', 'hello from client 2')
    })

    it('The client say method does not rely on order', (done) => {
      var listener = (response) => {
        clientA.removeListener('say', listener)
        expect(response.context).toBe('user')
        expect(response.message).toBe('hello from client 2')
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
        expect(response.context).toBe('user')
        expect(response.message).toBe('I have entered the room: ' + clientB.id)
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
        expect(response.context).toBe('user')
        expect(response.message).toBe('I have left the room: ' + clientB.id)
        done()
      }

      clientA.on('say', listener)
      clientB.roomLeave('defaultRoom')
    })

    it('will not get messages for rooms I am not in', (done) => {
      clientB.roomAdd('otherRoom', (response) => {
        expect(response.error).toBeUndefined()
        expect(clientB.rooms.length).toBe(2)

        var listener = (response) => {
          clientC.removeListener('say', listener)
          expect(response).toBeUndefined()
        }

        expect(clientC.rooms.length).toBe(1)
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
        expect(response.data.membersCount).toBe(3)
        clientB.roomLeave('defaultRoom', () => {
          clientA.roomView('defaultRoom', (response) => {
            expect(response.data.membersCount).toBe(2)
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
          expect(response.message).toBe('Test Message - To: ' + clientA.id) // clientA.id (Receiever)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          expect(response.message).toBe('Test Message - To: ' + clientB.id) // clientB.id (Receiever)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          expect(response.message).toBe('Test Message - To: ' + clientC.id) // clientC.id (Receiever)
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
          expect(messagesReceived).toBe(7)
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
          expect(response.message).toBe('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerB = (response) => {
          clientB.removeListener('say', listenerB)
          expect(response.message).toBe('Test Message - To: ' + clientB.id) // clientB.id (Sender)
        }

        var listenerC = (response) => {
          clientC.removeListener('say', listenerC)
          expect(response.message).toBe('Test Message - To: ' + clientB.id) // clientB.id (Sender)
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
            expect(response.data.room).toBe('defaultRoom')

            for (var key in response.data.members) {
              expect(response.data.members[key].type).toBeUndefined()
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
            expect(response.data.room).toBe('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).toBeUndefined()
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
            expect(response.data.room).toBe('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).toBe('websocket')
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
        expect(sleep).toBe(response.sleepDuration)
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
      expect(api.servers.servers.websocket.connections().length).toBe(3)
      clientA.disconnect()
      clientB.disconnect()
      clientC.disconnect()
      setTimeout(() => {
        expect(api.servers.servers.websocket.connections().length).toBe(0)
        done()
      }, 500)
    })

    it('can be sent disconnect events from the server', (done) => {
      clientA.detailsView((response) => {
        expect(response.data.remoteIP).toBe('127.0.0.1')

        var count = 0
        for (var id in api.connections.connections) {
          count++
          api.connections.connections[id].destroy()
        }
        expect(count).toBe(3)

        clientA.detailsView(() => {
          throw new Error('should not get response')
        })

        setTimeout(done, 500)
      })
    })
  })
})
