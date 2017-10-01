'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const uuid = require('uuid')
const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

const net = require('net')
let client
let client2
let client3

let client2Details = {}

const makeSocketRequest = async (thisClient, message, delimiter) => {
  let lines = []
  if (!delimiter) { delimiter = '\r\n' }

  let onData = (d) => {
    d.split(delimiter).forEach((l) => {
      if (l.length > 0) { lines.push(l) }
    })
    lines.push()
  }

  thisClient.on('data', onData)
  thisClient.write(message + delimiter)

  await sleep(100)
  thisClient.removeListener('data', onData)

  let lastLine = lines[(lines.length - 1)]
  let parsed = null
  try { parsed = JSON.parse(lastLine) } catch (e) {}
  return parsed
}

const connectClients = async () => {
  client = net.connect(api.config.servers.socket.port, () => { client.setEncoding('utf8') })
  client2 = net.connect(api.config.servers.socket.port, () => { client2.setEncoding('utf8') })
  client3 = net.connect(api.config.servers.socket.port, () => { client3.setEncoding('utf8') })

  await sleep(1000)
}

describe('Server: Socket', () => {
  before(async () => {
    api = await actionhero.start()
    await connectClients()
    let result = await makeSocketRequest(client2, 'detailsView')
    client2Details = result.data
  })

  after(async () => {
    client.write('quit\r\n')
    client2.write('quit\r\n')
    client3.write('quit\r\n')
    await actionhero.stop()
  })

  it('socket connections should be able to connect and get JSON', async () => {
    let response = await makeSocketRequest(client, 'hello')
    expect(response).to.be.instanceof(Object)
    expect(response.error).to.equal('unknown action or invalid apiVersion')
  })

  it('single string message are treated as actions', async () => {
    let response = await makeSocketRequest(client, 'status')
    expect(response).to.be.instanceof(Object)
    expect(response.id).to.equal('test-server-' + process.pid)
  })

  it('stringified JSON can also be sent as actions', async () => {
    let response = await makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}))
    expect(response).to.be.instanceof(Object)
    expect(response.id).to.equal('test-server-' + process.pid)
  })

  it('really long messages are OK', async () => {
    let msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    let response = await makeSocketRequest(client, JSON.stringify(msg))
    expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_' + msg.params.key)
    expect(response.cacheTestResults.loadResp.value).to.equal(msg.params.value)
  })

  it('I can get my details', async () => {
    let response = await makeSocketRequest(client2, 'detailsView')
    let now = new Date().getTime()
    expect(response.status).to.equal('OK')
    expect(response.data).to.be.instanceof(Object)
    expect(response.data.params).to.be.instanceof(Object)
    expect(response.data.connectedAt).to.be.at.least(now - 5000)
    expect(response.data.connectedAt).to.be.at.most(now)
    expect(response.data.id).to.equal(response.data.fingerprint)
    client2Details = response.data // save for later!
  })

  it('params can be updated', async () => {
    let response = await makeSocketRequest(client, 'paramAdd key=otherKey')
    expect(response.status).to.equal('OK')
    let responseAgain = await makeSocketRequest(client, 'paramsView')
    expect(responseAgain.data.key).to.equal('otherKey')
  })

  it('actions will fail without proper params set to the connection', async () => {
    await makeSocketRequest(client, 'paramDelete key')
    let response = await makeSocketRequest(client, 'cacheTest')
    expect(response.error).to.equal('key is a required parameter for this action')
  })

  it('a new param can be added and viewed', async () => {
    let response = await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    expect(response.status).to.equal('OK')
    let viewResponse = await makeSocketRequest(client, 'paramView key')
    expect(viewResponse.data).to.equal('socketTestKey')
  })

  it('another new param can be added and viewed', async () => {
    let response = await makeSocketRequest(client, 'paramAdd value=abc123')
    expect(response.status).to.equal('OK')
    let viewResponse = await makeSocketRequest(client, 'paramView value')
    expect(viewResponse.data).to.equal('abc123')
  })

  it('actions will work once all the needed params are added', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    let response = await makeSocketRequest(client, 'cacheTest')
    expect(response.cacheTestResults.saveResp).to.equal(true)
  })

  it('params are sticky between actions', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    let response = await makeSocketRequest(client, 'cacheTest')
    expect(response.error).to.not.exist()
    expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_socketTestKey')
    expect(response.cacheTestResults.loadResp.value).to.equal('abc123')

    let responseAgain = await makeSocketRequest(client, 'cacheTest')
    expect(responseAgain.cacheTestResults.loadResp.key).to.equal('cacheTest_socketTestKey')
    expect(responseAgain.cacheTestResults.loadResp.value).to.equal('abc123')
  })

  it('only params sent in a JSON block are used', async () => {
    let response = await makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}))
    expect(response.error).to.equal('value is a required parameter for this action')
  })

  it('will limit how many simultaneous connections I can have', async () => {
    let responses = []
    let msg = ''
    let i = 0

    while (i <= api.config.general.simultaneousActions) {
      msg += `${JSON.stringify({action: 'sleepTest', sleepDuration: 100})} \r\n`
      i++
    }

    await new Promise((resolve) => {
      const checkResponses = (data) => {
        data.split('\n').forEach((line) => {
          if (line.length > 0 && line.indexOf('welcome') < 0) { responses.push(JSON.parse(line)) }
        })

        if (responses.length >= (api.config.general.simultaneousActions + 1)) {
          client.removeListener('data', checkResponses)
          for (let i in responses) {
            let response = responses[i]
            if (i === '0') {
              expect(response.error).to.equal('you have too many pending requests')
            } else {
              expect(response.error).to.not.exist()
            }
          }

          resolve()
        }
      }

      client.on('data', checkResponses)
      client.write(msg)
    })
  })

  describe('maxDataLength', () => {
    before(() => { api.config.servers.socket.maxDataLength = 64 })
    after(() => { api.config.servers.socket.maxDataLength = 0 })

    it('will error If received data length is bigger then maxDataLength', async () => {
      let msg = {
        action: 'cacheTest',
        params: {
          key: uuid.v4(),
          value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
        }
      }

      let response = await makeSocketRequest(client, JSON.stringify(msg))
      expect(response.status).to.equal('error')
      expect(response.error).to.equal('data length is too big (64 received/449 max)')
    })
  })

  describe('custom data delimiter', () => {
    after(() => { api.config.servers.socket.delimiter = '\n' })

    it('will parse /newline data delimiter', async () => {
      api.config.servers.socket.delimiter = '\n'
      let response = await makeSocketRequest(client, JSON.stringify({action: 'status'}), '\n')
      expect(response.context).to.equal('response')
    })

    it('will parse custom `^]` data delimiter', async () => {
      api.config.servers.socket.delimiter = '^]'
      let response = await makeSocketRequest(client, JSON.stringify({action: 'status'}), '^]')
      expect(response.context).to.equal('response')
    })
  })

  describe('chat', () => {
    before(() => {
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
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
    })

    after(() => {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []
    })

    beforeEach(async () => {
      await makeSocketRequest(client, 'roomAdd defaultRoom')
      await makeSocketRequest(client2, 'roomAdd defaultRoom')
      await makeSocketRequest(client3, 'roomAdd defaultRoom')
      await sleep(250)
    })

    afterEach(async () => {
      ['defaultRoom', 'otherRoom'].forEach(async (room) => {
        await makeSocketRequest(client, 'roomLeave ' + room)
        await makeSocketRequest(client2, 'roomLeave ' + room)
        await makeSocketRequest(client3, 'roomLeave ' + room)
      })
      await sleep(250)
    })

    it('clients are in the default room', async () => {
      let response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.room).to.equal('defaultRoom')
    })

    it('clients can view additional info about rooms they are in', async () => {
      let response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.membersCount).to.equal(3)
    })

    it('clients see an appropriate error when viewing rooms they are not in', async () => {
      let response = await makeSocketRequest(client, 'roomView notARoom')
      expect(response.error).to.match(/connection not in this room/)
    })

    it('rooms can be changed', async () => {
      await makeSocketRequest(client, 'roomAdd otherRoom')
      let response = await makeSocketRequest(client, 'roomLeave defaultRoom')
      expect(response.status).to.equal('OK')
      let responseAgain = await makeSocketRequest(client, 'roomView otherRoom')
      expect(responseAgain.data.room).to.equal('otherRoom')
      expect(responseAgain.data.membersCount).to.equal(1)
    })

    it('connections in the first room see the count go down', async () => {
      await makeSocketRequest(client, 'roomAdd   otherRoom')
      await makeSocketRequest(client, 'roomLeave defaultRoom')
      let response = await makeSocketRequest(client2, 'roomView defaultRoom')
      expect(response.data.room).to.equal('defaultRoom')
      expect(response.data.membersCount).to.equal(2)
    })

    it('folks in my room hear what I say (and say works)', async () => {
      await new Promise(async (resolve) => {
        makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n')
        let response = await makeSocketRequest(client3, '')
        expect(response.message).to.equal('hello?')
        resolve()
      })
    })

    it('folks not in my room no not hear what I say', async () => {
      await makeSocketRequest(client, 'roomLeave defaultRoom')

      await new Promise(async (resolve) => {
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n')
        let response = await makeSocketRequest(client, '')
        expect(response).to.be.null()
        resolve()
      })

      await new Promise(async (resolve) => {
        makeSocketRequest(client, 'say defaultRoom I should not hear myself' + '\r\n')
        let response = await makeSocketRequest(client, '')
        // there will be the say response, but no message
        expect(response.room).to.not.exist()
        resolve()
      })
    })

    it('I can get my id', async () => {
      let response = await makeSocketRequest(client, 'detailsView')
      expect(response.status).to.equal('OK')
      expect(response.data.remoteIP).to.equal('127.0.0.1')
    })

    describe('custom room member data', () => {
      let currentSanitize
      let currentGenerate

      before(async () => {
        // Ensure that default behavior works
        await makeSocketRequest(client2, 'roomAdd defaultRoom')
        let response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).to.equal('defaultRoom')
        for (let key in response.data.members) {
          expect(response.data.members[key].type).to.not.exist()
        }
        await makeSocketRequest(client2, 'roomLeave defaultRoom')

        // save off current functions
        currentSanitize = api.chatRoom.sanitizeMemberDetails
        currentGenerate = api.chatRoom.generateMemberDetails

        // override functions
        api.chatRoom.sanitizeMemberDetails = (connection) => {
          return {
            id: connection.id,
            joinedAt: connection.joinedAt,
            type: connection.type
          }
        }

        api.chatRoom.generateMemberDetails = (connection) => {
          return {
            id: connection.id,
            joinedAt: new Date().getTime(),
            type: connection.type
          }
        }
      })

      after(() => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate
      })

      it('should view non-default member data', async () => {
        await makeSocketRequest(client2, 'roomAdd defaultRoom')
        let response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).to.equal('defaultRoom')
        for (let key in response.data.members) {
          expect(response.data.members[key].type).to.equal('socket')
        }
        await makeSocketRequest(client2, 'roomLeave defaultRoom')
      })
    })

    it('Folks are notified when I join a room', async () => {
      await makeSocketRequest(client, 'roomAdd otherRoom')
      makeSocketRequest(client2, 'roomAdd otherRoom')
      let response = await makeSocketRequest(client, '')
      expect(response.message).to.equal('I have entered the room: ' + client2Details.id)
      expect(response.from).to.equal(0)
    })

    it('Folks are notified when I leave a room', async () => {
      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n')
      let response = await makeSocketRequest(client, '')
      expect(response.message).to.equal('I have left the room: ' + client2Details.id)
      expect(response.from).to.equal(0)
    })
  })

  describe('disconnect', () => {
    after(async () => { await connectClients() })

    it('server can disconnect a client', async () => {
      let response = await makeSocketRequest(client, 'status')
      expect(response.id).to.equal('test-server-' + process.pid)
      expect(client.readable).to.equal(true)
      expect(client.writable).to.equal(true)

      for (let id in api.connections.connections) {
        api.connections.connections[id].destroy()
      }

      await sleep(100)

      expect(client.readable).to.equal(false)
      expect(client.writable).to.equal(false)
    })
  })
})
