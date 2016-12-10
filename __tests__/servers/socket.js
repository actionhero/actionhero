'use strict'

var uuid = require('uuid')
var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var net = require('net')
var client = {}
var client2 = {}
var client3 = {}

var client2Details = {}

function makeSocketRequest (thisClient, message, cb, delimiter) {
  var lines = []
  var counter = 0

  if (delimiter === null || typeof delimiter === 'undefined') {
    delimiter = '\r\n'
  }

  var rsp = function (d) {
    d.split(delimiter).forEach(function (l) {
      lines.push(l)
    })
    lines.push()
  }

  var respoder = function () {
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
  setTimeout(function () {
    callback()
  }, 1000)

  client = net.connect(api.config.servers.socket.port, function () {
    client.setEncoding('utf8')
  })
  client2 = net.connect(api.config.servers.socket.port, function () {
    client2.setEncoding('utf8')
  })
  client3 = net.connect(api.config.servers.socket.port, function () {
    client3.setEncoding('utf8')
  })
}

describe('Server: Socket', function () {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      connectClients(done)
    })
  })

  afterAll((done) => {
    client.write('quit\r\n')
    client2.write('quit\r\n')
    client3.write('quit\r\n')
    actionhero.stop(() => {
      done()
    })
  })

  it('socket connections should be able to connect and get JSON', (done) => {
    makeSocketRequest(client, 'hello', (response) => {
      response.should.be.an.instanceOf(Object)
      response.error.should.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('single string message are treated as actions', (done) => {
    makeSocketRequest(client, 'status', (response) => {
      response.should.be.an.instanceOf(Object)
      response.id.should.equal('test-server')
      done()
    })
  })

  it('stringified JSON can also be sent as actions', (done) => {
    makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}), (response) => {
      response.should.be.an.instanceOf(Object)
      response.id.should.equal('test-server')
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
      response.cacheTestResults.loadResp.key.should.eql('cacheTest_' + msg.params.key)
      response.cacheTestResults.loadResp.value.should.eql(msg.params.value)
      done()
    })
  })

  it('I can get my details', (done) => {
    makeSocketRequest(client2, 'detailsView', (response) => {
      response.status.should.equal('OK')
      response.data.should.be.an.instanceOf(Object)
      response.data.params.should.be.an.instanceOf(Object)
      response.data.connectedAt.should.be.within(10, new Date().getTime())
      response.data.id.should.equal(response.data.fingerprint)
      client2Details = response.data // save for later!
      done()
    })
  })

  it('params can be updated', (done) => {
    makeSocketRequest(client, 'paramAdd key=otherKey', (response) => {
      response.status.should.equal('OK')
      makeSocketRequest(client, 'paramsView', (response) => {
        response.data.key.should.equal('otherKey')
        done()
      })
    })
  })

  it('actions will fail without proper params set to the connection', (done) => {
    makeSocketRequest(client, 'paramDelete key', function () {
      makeSocketRequest(client, 'cacheTest', (response) => {
        response.error.should.equal('key is a required parameter for this action')
        done()
      })
    })
  })

  it('a new param can be added', (done) => {
    makeSocketRequest(client, 'paramAdd key=socketTestKey', (response) => {
      response.status.should.equal('OK')
      done()
    })
  })

  it('a new param can be viewed once added', (done) => {
    makeSocketRequest(client, 'paramView key', (response) => {
      response.data.should.equal('socketTestKey')
      done()
    })
  })

  it('another new param can be added', (done) => {
    makeSocketRequest(client, 'paramAdd value=abc123', (response) => {
      response.status.should.equal('OK')
      done()
    })
  })

  it('actions will work once all the needed params are added', (done) => {
    makeSocketRequest(client, 'cacheTest', (response) => {
      response.cacheTestResults.saveResp.should.equal(true)
      done()
    })
  })

  it('params are sticky between actions', (done) => {
    makeSocketRequest(client, 'cacheTest', (response) => {
      should.not.exist(response.error)
      response.cacheTestResults.loadResp.key.should.equal('cacheTest_socketTestKey')
      response.cacheTestResults.loadResp.value.should.equal('abc123')
      makeSocketRequest(client, 'cacheTest', (response) => {
        response.cacheTestResults.loadResp.key.should.equal('cacheTest_socketTestKey')
        response.cacheTestResults.loadResp.value.should.equal('abc123')
        done()
      })
    })
  })

  it('only params sent in a JSON block are used', (done) => {
    makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}), (response) => {
      response.error.should.equal('value is a required parameter for this action')
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
      data.split('\n').forEach(function (line) {
        if (line.length > 0) {
          responses.push(JSON.parse(line))
        }
      })
      if (responses.length === 6) {
        client.removeListener('data', checkResponses)
        for (var i in responses) {
          var response = responses[i]
          if (i === '0') {
            response.error.should.eql('you have too many pending requests')
          } else {
            should.not.exist(response.error)
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
      response.should.containEql({status: 'error', error: 'data length is too big (64 received/449 max)'})
      // Return maxDataLength back to normal
      api.config.servers.socket.maxDataLength = 0
      done()
    })
  })

  describe('custom data delimiter', function () {
    afterAll((done) => {
      // Return the config back to normal so we don't error other tests
      api.config.servers.socket.delimiter = '\n'
      done()
    })

    it('will parse /newline data delimiter', (done) => {
      api.config.servers.socket.delimiter = '\n'
      makeSocketRequest(client, JSON.stringify({action: 'status'}), (response) => {
        response.context.should.equal('response')
        done()
      }, '\n')
    })

    it('will parse custom `^]` data delimiter', (done) => {
      api.config.servers.socket.delimiter = '^]'
      makeSocketRequest(client, JSON.stringify({action: 'status'}), (response) => {
        response.context.should.equal('response')
        done()
      }, '^]')
    })
  })

  describe('chat', function () {
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
      makeSocketRequest(client, 'roomAdd defaultRoom')
      makeSocketRequest(client2, 'roomAdd defaultRoom')
      makeSocketRequest(client3, 'roomAdd defaultRoom')
      setTimeout(function () {
        done()
      }, 250)
    })

    afterEach((done) => {
      ['defaultRoom', 'otherRoom'].forEach(function (room) {
        makeSocketRequest(client, 'roomLeave ' + room)
        makeSocketRequest(client2, 'roomLeave ' + room)
        makeSocketRequest(client3, 'roomLeave ' + room)
      })
      setTimeout(function () {
        done()
      }, 250)
    })

    it('clients are in the default room', (done) => {
      makeSocketRequest(client, 'roomView defaultRoom', (response) => {
        response.data.room.should.equal('defaultRoom')
        done()
      })
    })

    it('clients can view additional info about rooms they are in', (done) => {
      makeSocketRequest(client, 'roomView defaultRoom', (response) => {
        response.data.membersCount.should.equal(3)
        done()
      })
    })

    it('rooms can be changed', (done) => {
      makeSocketRequest(client, 'roomAdd otherRoom', function () {
        makeSocketRequest(client, 'roomLeave defaultRoom', (response) => {
          response.status.should.equal('OK')
          makeSocketRequest(client, 'roomView otherRoom', (response) => {
            response.data.room.should.equal('otherRoom')
            done()
          })
        })
      })
    })

    it('connections in the first room see the count go down', (done) => {
      makeSocketRequest(client, 'roomAdd   otherRoom', function () {
        makeSocketRequest(client, 'roomLeave defaultRoom', function () {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')
            response.data.membersCount.should.equal(2)
            done()
          })
        })
      })
    })

    describe('custom room member data', function () {
      var currentSanitize
      var currentGenerate

      beforeAll((done) => {
        // Ensure that default behavior works
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')
            for (var key in response.data.members) {
              (response.data.members[key].type === undefined).should.eql(true)
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

      afterAll((done) => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate

        // Check that everything is back to normal
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')
            for (var key in response.data.members) {
              (response.data.members[key].type === undefined).should.eql(true)
            }
            makeSocketRequest(client2, 'roomLeave defaultRoom')

            done()
          })
        })
      })

      it('should view non-default member data', (done) => {
        makeSocketRequest(client2, 'roomAdd defaultRoom', (response) => {
          makeSocketRequest(client2, 'roomView defaultRoom', (response) => {
            response.data.room.should.equal('defaultRoom')
            for (var key in response.data.members) {
              response.data.members[key].type.should.eql('socket')
            }
            makeSocketRequest(client2, 'roomLeave defaultRoom')
            done()
          })
        })
      })
    })

    it('folks in my room hear what I say (and say works)', (done) => {
      makeSocketRequest(client3, '', (response) => {
        response.message.should.equal('hello?')
        done()
      })

      makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n')
    })

    it('folks NOT in my room DON\'T hear what I say', (done) => {
      makeSocketRequest(client, 'roomLeave defaultRoom', function () {
        makeSocketRequest(client, '', (response) => {
          should.not.exist(response)
          done()
        })
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n')
      })
    })

    it('Folks are notified when I join a room', (done) => {
      makeSocketRequest(client, 'roomAdd otherRoom', function () {
        makeSocketRequest(client2, 'roomAdd otherRoom' + '\r\n')
        makeSocketRequest(client, '', (response) => {
          response.message.should.equal('I have entered the room: ' + client2Details.id)
          response.from.should.equal(0)
          done()
        })
      })
    })

    it('Folks are notified when I leave a room', (done) => {
      makeSocketRequest(client, '', (response) => {
        response.message.should.equal('I have left the room: ' + client2Details.id)
        response.from.should.equal(0)
        done()
      })

      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n')
    })

    it('I can get my id', (done) => {
      makeSocketRequest(client, 'detailsView' + '\r\n', (response) => {
        done()
      })
    })
  })

  describe('disconnect', function () {
    afterAll((done) => {
      connectClients(done)
    })

    it('server can disconnect a client', (done) => {
      makeSocketRequest(client, 'status', (response) => {
        response.id.should.equal('test-server')
        client.readable.should.equal(true)
        client.writable.should.equal(true)

        for (var id in api.connections.connections) {
          api.connections.connections[id].destroy()
        }

        setTimeout(function () {
          client.readable.should.equal(false)
          client.writable.should.equal(false)
          done()
        }, 100)
      })
    })
  })
})
