'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

var uuid = require('uuid')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var net = require('net')
var client = {}
var client2 = {}
var client3 = {}

var client2Details = {}

var makeSocketRequest = function (thisClient, message, cb, delimiter) {
  var lines = []
  var counter = 0

  if (delimiter === null || typeof delimiter === 'undefined') {
    delimiter = '\r\n'
  }

  var rsp = (d) => {
    d.split(delimiter).forEach((l) => {
      lines.push(l)
    })
    lines.push()
  }

  var respoder = () => {
    if (lines.length === 0 && counter < 20) {
      counter++
      return setTimeout(respoder, 10)
    }

    var lastLine = lines[(lines.length - 1)]
    if (lastLine === '') { lastLine = lines[(lines.length - 2)] }
    var parsed = null
    try { parsed = JSON.parse(lastLine) } catch (e) {}
    thisClient.removeListener('data', rsp)
    if (typeof cb === 'function') { cb(parsed) }
  }

  setTimeout(respoder, 50)
  thisClient.on('data', rsp)
  thisClient.write(message + delimiter)
}

var connectClients = function (callback) {
  setTimeout(callback, 1000)
  client = net.connect(api.config.servers.socket.port, () => {
    client.setEncoding('utf8')
  })
  client2 = net.connect(api.config.servers.socket.port, () => {
    client2.setEncoding('utf8')
  })
  client3 = net.connect(api.config.servers.socket.port, () => {
    client3.setEncoding('utf8')
  })
}

describe('Server: Socket', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      connectClients(done)
    })
  })

  after((done) => {
    client.write('quit\r\n')
    client2.write('quit\r\n')
    client3.write('quit\r\n')
    actionhero.stop(() => {
      done()
    })
  })

  it('socket connections should be able to connect and get JSON', (done) => {
    makeSocketRequest(client, 'hello', (response) => {
      expect(response).to.be.instanceof(Object)
      expect(response.error).to.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('single string message are treated as actions', (done) => {
    makeSocketRequest(client, 'status', (response) => {
      expect(response).to.be.instanceof(Object)
      expect(response.id).to.equal('test-server-' + process.pid)
      done()
    })
  })

  it('stringified JSON can also be sent as actions', (done) => {
    makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}), (response) => {
      expect(response).to.be.instanceof(Object)
      expect(response.id).to.equal('test-server-' + process.pid)
      done()
    })
  })

  it('really long messages are OK', (done) => {
    var msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }
    makeSocketRequest(client, JSON.stringify(msg), (response) => {
      expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_' + msg.params.key)
      expect(response.cacheTestResults.loadResp.value).to.equal(msg.params.value)
      done()
    })
  })

  it('I can get my details', (done) => {
    makeSocketRequest(client2, 'detailsView', (response) => {
      var now = new Date().getTime()
      expect(response.status).to.equal('OK')
      expect(response.data).to.be.instanceof(Object)
      expect(response.data.params).to.be.instanceof(Object)
      expect(response.data.connectedAt).to.be.at.least(now - 5000)
      expect(response.data.connectedAt).to.be.at.most(now)
      expect(response.data.id).to.equal(response.data.fingerprint)
      client2Details = response.data // save for later!
      done()
    })
  })

  it('params can be updated', (done) => {
    makeSocketRequest(client, 'paramAdd key=otherKey', (response) => {
      expect(response.status).to.equal('OK')
      makeSocketRequest(client, 'paramsView', (response) => {
        expect(response.data.key).to.equal('otherKey')
        done()
      })
    })
  })

  it('actions will fail without proper params set to the connection', (done) => {
    makeSocketRequest(client, 'paramDelete key', () => {
      makeSocketRequest(client, 'cacheTest', (response) => {
        expect(response.error).to.equal('key is a required parameter for this action')
        done()
      })
    })
  })

  it('a new param can be added', (done) => {
    makeSocketRequest(client, 'paramAdd key=socketTestKey', (response) => {
      expect(response.status).to.equal('OK')
      done()
    })
  })

  it('a new param can be viewed once added', (done) => {
    makeSocketRequest(client, 'paramView key', (response) => {
      expect(response.data).to.equal('socketTestKey')
      done()
    })
  })

  it('another new param can be added', (done) => {
    makeSocketRequest(client, 'paramAdd value=abc123', (response) => {
      expect(response.status).to.equal('OK')
      done()
    })
  })

  it('actions will work once all the needed params are added', (done) => {
    makeSocketRequest(client, 'cacheTest', (response) => {
      expect(response.cacheTestResults.saveResp).to.equal(true)
      done()
    })
  })

  it('params are sticky between actions', (done) => {
    makeSocketRequest(client, 'cacheTest', (response) => {
      expect(response.error).to.not.exist()
      expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_socketTestKey')
      expect(response.cacheTestResults.loadResp.value).to.equal('abc123')
      makeSocketRequest(client, 'cacheTest', (response) => {
        expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_socketTestKey')
        expect(response.cacheTestResults.loadResp.value).to.equal('abc123')
        done()
      })
    })
  })

  it('only params sent in a JSON block are used', (done) => {
    makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}), (response) => {
      expect(response.error).to.equal('value is a required parameter for this action')
      done()
    })
  })

  it('will limit how many simultaneous connections I can have', (done) => {
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 500}}) + '\r\n')
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 600}}) + '\r\n')
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 700}}) + '\r\n')
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 800}}) + '\r\n')
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 900}}) + '\r\n')
    client.write(JSON.stringify({action: 'sleepTest', params: {sleepDuration: 1000}}) + '\r\n')

    var responses = []
    var checkResponses = function (data) {
      data.split('\n').forEach((line) => {
        if (line.length > 0) {
          responses.push(JSON.parse(line))
        }
      })
      if (responses.length === 6) {
        client.removeListener('data', checkResponses)
        for (var i in responses) {
          var response = responses[i]
          if (i === '0') {
            expect(response.error).to.equal('you have too many pending requests')
          } else {
            expect(response.error).to.not.exist()
          }
        }
        done()
      }
    }

    client.on('data', checkResponses)
  })

  it('will error If received data length is bigger then maxDataLength', (done) => {
    api.config.servers.socket.maxDataLength = 64

    var msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    makeSocketRequest(client, JSON.stringify(msg), (response) => {
      expect(response.status).to.equal('error')
      expect(response.error).to.equal('data length is too big (64 received/449 max)')
      // Return maxDataLength back to normal
      api.config.servers.socket.maxDataLength = 0
      done()
    })
  })

  describe('custom data delimiter', () => {
    after((done) => {
      // Return the config back to normal so we don't error other tests
      api.config.servers.socket.delimiter = '\n'
      done()
    })

    it('will parse /newline data delimiter', (done) => {
      api.config.servers.socket.delimiter = '\n'
      makeSocketRequest(client, JSON.stringify({action: 'status'}), (response) => {
        expect(response.context).to.equal('response')
        done()
      }, '\n')
    })

    it('will parse custom `^]` data delimiter', (done) => {
      api.config.servers.socket.delimiter = '^]'
      makeSocketRequest(client, JSON.stringify({action: 'status'}), (response) => {
        expect(response.context).to.equal('response')
        done()
      }, '^]')
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
      makeSocketRequest(client, 'roomAdd defaultRoom')
      makeSocketRequest(client2, 'roomAdd defaultRoom')
      makeSocketRequest(client3, 'roomAdd defaultRoom')
      setTimeout(done, 250)
    })

    afterEach((done) => {
      ['defaultRoom', 'otherRoom'].forEach((room) => {
        makeSocketRequest(client, 'roomLeave ' + room)
        makeSocketRequest(client2, 'roomLeave ' + room)
        makeSocketRequest(client3, 'roomLeave ' + room)
      })
      setTimeout(done, 250)
    })

    it('clients are in the default room', (done) => {
      makeSocketRequest(client, 'roomView defaultRoom', (response) => {
        expect(response.data.room).to.equal('defaultRoom')
        done()
      })
    })

    it('clients can view additional info about rooms they are in', (done) => {
      makeSocketRequest(client, 'roomView defaultRoom', (response) => {
        expect(response.data.membersCount).to.equal(3)
        done()
      })
    })

    it('rooms can be changed', (done) => {
      makeSocketRequest(client, 'roomAdd otherRoom', () => {
        makeSocketRequest(client, 'roomLeave defaultRoom', (response) => {
          expect(response.status).to.equal('OK')
          makeSocketRequest(client, 'roomView otherRoom', (response) => {
            expect(response.data.room).to.equal('otherRoom')
            expect(response.data.membersCount).to.equal(1)
            done()
          })
        })
      })
    })

    it('connections in the first room see the count go down', (done) => {
      makeSocketRequest(client, 'roomAdd   otherRoom', () => {
        makeSocketRequest(client, 'roomLeave defaultRoom', () => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            expect(response.data.membersCount).to.equal(2)
            done()
          })
        })
      })
    })

    it('folks in my room hear what I say (and say works)', (done) => {
      makeSocketRequest(client3, '', (response) => {
        expect(response.message).to.equal('hello?')
        done()
      })

      makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n')
    })

    it('folks NOT in my room DON\'T hear what I say', (done) => {
      makeSocketRequest(client, 'roomLeave defaultRoom', () => {
        makeSocketRequest(client, '', (response) => {
          expect(response).to.be.null()
          done()
        })
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n')
      })
    })

    it('I can get my id', (done) => {
      makeSocketRequest(client, 'detailsView' + '\r\n', (response) => {
        done()
      })
    })

    describe('custom room member data', () => {
      var currentSanitize
      var currentGenerate

      before((done) => {
        // Ensure that default behavior works
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.not.exist()
            }
            makeSocketRequest(client2, 'roomLeave defaultRoom')

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
            done()
          })
        })
      })

      after((done) => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate

        // Check that everything is back to normal
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.not.exist()
            }
            makeSocketRequest(client2, 'roomLeave defaultRoom')

            done()
          })
        })
      })

      it('should view non-default member data', (done) => {
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            expect(response.data.room).to.equal('defaultRoom')
            for (var key in response.data.members) {
              expect(response.data.members[key].type).to.equal('socket')
            }
            makeSocketRequest(client2, 'roomLeave defaultRoom')
            done()
          })
        })
      })
    })

    it('Folks are notified when I join a room', (done) => {
      makeSocketRequest(client, 'roomAdd otherRoom', () => {
        makeSocketRequest(client2, 'roomAdd otherRoom' + '\r\n')
        makeSocketRequest(client, '', (response) => {
          expect(response.message).to.equal('I have entered the room: ' + client2Details.id)
          expect(response.from).to.equal(0)
          done()
        })
      })
    })

    it('Folks are notified when I leave a room', (done) => {
      makeSocketRequest(client, '', (response) => {
        expect(response.message).to.equal('I have left the room: ' + client2Details.id)
        expect(response.from).to.equal(0)
        done()
      })

      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n')
    })
  })

  describe('disconnect', () => {
    after((done) => {
      connectClients(done)
    })

    it('server can disconnect a client', (done) => {
      makeSocketRequest(client, 'status', (response) => {
        expect(response.id).to.equal('test-server-' + process.pid)
        expect(client.readable).to.equal(true)
        expect(client.writable).to.equal(true)

        for (var id in api.connections.connections) {
          api.connections.connections[id].destroy()
        }

        setTimeout(() => {
          expect(client.readable).to.equal(false)
          expect(client.writable).to.equal(false)
          done()
        }, 100)
      })
    })
  })
})
