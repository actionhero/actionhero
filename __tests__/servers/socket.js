'use strict'

const uuid = require('uuid')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

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

  await api.utils.sleep(100)
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

  await api.utils.sleep(1000)
}

describe('Server: Socket', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    await connectClients()
    let result = await makeSocketRequest(client2, 'detailsView')
    client2Details = result.data
  })

  afterAll(async () => {
    client.write('quit\r\n')
    client2.write('quit\r\n')
    client3.write('quit\r\n')
    await actionhero.stop()
  })

  test('socket connections should be able to connect and get JSON', async () => {
    let response = await makeSocketRequest(client, 'hello')
    expect(response).toBeInstanceOf(Object)
    expect(response.error).toEqual('unknown action or invalid apiVersion')
  })

  test('single string message are treated as actions', async () => {
    let response = await makeSocketRequest(client, 'status')
    expect(response).toBeInstanceOf(Object)
    expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
  })

  test('stringified JSON can also be sent as actions', async () => {
    let response = await makeSocketRequest(client, JSON.stringify({action: 'status', params: {something: 'else'}}))
    expect(response).toBeInstanceOf(Object)
    expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
  })

  test('really long messages are OK', async () => {
    let msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    let response = await makeSocketRequest(client, JSON.stringify(msg))
    expect(response.cacheTestResults.loadResp.key).toEqual('cacheTest_' + msg.params.key)
    expect(response.cacheTestResults.loadResp.value).toEqual(msg.params.value)
  })

  test('I can get my details', async () => {
    let response = await makeSocketRequest(client2, 'detailsView')
    let now = new Date().getTime()
    expect(response.status).toEqual('OK')
    expect(response.data).toBeInstanceOf(Object)
    expect(response.data.params).toBeInstanceOf(Object)
    expect(response.data.connectedAt).toBeGreaterThanOrEqual(now - 5000)
    expect(response.data.connectedAt).toBeLessThan(now)
    expect(response.data.id).toEqual(response.data.fingerprint)
    client2Details = response.data // save for later!
  })

  test('params can be updated', async () => {
    let response = await makeSocketRequest(client, 'paramAdd key=otherKey')
    expect(response.status).toEqual('OK')
    let responseAgain = await makeSocketRequest(client, 'paramsView')
    expect(responseAgain.data.key).toEqual('otherKey')
  })

  test(
    'actions will fail without proper params set to the connection',
    async () => {
      await makeSocketRequest(client, 'paramDelete key')
      let response = await makeSocketRequest(client, 'cacheTest')
      expect(response.error).toEqual('key is a required parameter for this action')
    }
  )

  test('a new param can be added and viewed', async () => {
    let response = await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    expect(response.status).toEqual('OK')
    let viewResponse = await makeSocketRequest(client, 'paramView key')
    expect(viewResponse.data).toEqual('socketTestKey')
  })

  test('another new param can be added and viewed', async () => {
    let response = await makeSocketRequest(client, 'paramAdd value=abc123')
    expect(response.status).toEqual('OK')
    let viewResponse = await makeSocketRequest(client, 'paramView value')
    expect(viewResponse.data).toEqual('abc123')
  })

  test('actions will work once all the needed params are added', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    let response = await makeSocketRequest(client, 'cacheTest')
    expect(response.cacheTestResults.saveResp).toEqual(true)
  })

  test('params are sticky between actions', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    let response = await makeSocketRequest(client, 'cacheTest')
    expect(response.error).toBeUndefined()
    expect(response.cacheTestResults.loadResp.key).toEqual('cacheTest_socketTestKey')
    expect(response.cacheTestResults.loadResp.value).toEqual('abc123')

    let responseAgain = await makeSocketRequest(client, 'cacheTest')
    expect(responseAgain.cacheTestResults.loadResp.key).toEqual('cacheTest_socketTestKey')
    expect(responseAgain.cacheTestResults.loadResp.value).toEqual('abc123')
  })

  test('only params sent in a JSON block are used', async () => {
    let response = await makeSocketRequest(client, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherValue'}}))
    expect(response.error).toEqual('value is a required parameter for this action')
  })

  test('will limit how many simultaneous connections I can have', async () => {
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
              expect(response.error).toEqual('you have too many pending requests')
            } else {
              expect(response.error).toBeUndefined()
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
    beforeAll(() => { api.config.servers.socket.maxDataLength = 64 })
    afterAll(() => { api.config.servers.socket.maxDataLength = 0 })

    test(
      'will error If received data length is bigger then maxDataLength',
      async () => {
        let msg = {
          action: 'cacheTest',
          params: {
            key: uuid.v4(),
            value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
          }
        }

        let response = await makeSocketRequest(client, JSON.stringify(msg))
        expect(response.status).toEqual('error')
        expect(response.error).toEqual('data length is too big (64 received/449 max)')
      }
    )
  })

  describe('custom data delimiter', () => {
    afterAll(() => { api.config.servers.socket.delimiter = '\n' })

    test('will parse /newline data delimiter', async () => {
      api.config.servers.socket.delimiter = '\n'
      let response = await makeSocketRequest(client, JSON.stringify({action: 'status'}), '\n')
      expect(response.context).toEqual('response')
    })

    test('will parse custom `^]` data delimiter', async () => {
      api.config.servers.socket.delimiter = '^]'
      let response = await makeSocketRequest(client, JSON.stringify({action: 'status'}), '^]')
      expect(response.context).toEqual('response')
    })
  })

  describe('chat', () => {
    beforeAll(() => {
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

    afterAll(() => {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []
    })

    beforeEach(async () => {
      await makeSocketRequest(client, 'roomAdd defaultRoom')
      await makeSocketRequest(client2, 'roomAdd defaultRoom')
      await makeSocketRequest(client3, 'roomAdd defaultRoom')
      await api.utils.sleep(250)
    })

    afterEach(async () => {
      ['defaultRoom', 'otherRoom'].forEach(async (room) => {
        await makeSocketRequest(client, 'roomLeave ' + room)
        await makeSocketRequest(client2, 'roomLeave ' + room)
        await makeSocketRequest(client3, 'roomLeave ' + room)
      })
      await api.utils.sleep(250)
    })

    test('clients are in the default room', async () => {
      let response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.room).toEqual('defaultRoom')
    })

    test('clients can view additional info about rooms they are in', async () => {
      let response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.membersCount).toEqual(3)
    })

    test(
      'clients see an appropriate error when viewing rooms they are not in',
      async () => {
        let response = await makeSocketRequest(client, 'roomView notARoom')
        expect(response.error).toMatch(/connection not in this room/)
      }
    )

    test('rooms can be changed', async () => {
      await makeSocketRequest(client, 'roomAdd otherRoom')
      let response = await makeSocketRequest(client, 'roomLeave defaultRoom')
      expect(response.status).toEqual('OK')
      let responseAgain = await makeSocketRequest(client, 'roomView otherRoom')
      expect(responseAgain.data.room).toEqual('otherRoom')
      expect(responseAgain.data.membersCount).toEqual(1)
    })

    test('connections in the first room see the count go down', async () => {
      await makeSocketRequest(client, 'roomAdd   otherRoom')
      await makeSocketRequest(client, 'roomLeave defaultRoom')
      let response = await makeSocketRequest(client2, 'roomView defaultRoom')
      expect(response.data.room).toEqual('defaultRoom')
      expect(response.data.membersCount).toEqual(2)
    })

    test('folks in my room hear what I say (and say works)', async () => {
      await new Promise(async (resolve) => {
        makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n')
        let response = await makeSocketRequest(client3, '')
        expect(response.message).toEqual('hello?')
        resolve()
      })
    })

    test('folks not in my room no not hear what I say', async () => {
      await makeSocketRequest(client, 'roomLeave defaultRoom')

      await new Promise(async (resolve) => {
        makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n')
        let response = await makeSocketRequest(client, '')
        expect(response).toBeNull()
        resolve()
      })

      await new Promise(async (resolve) => {
        makeSocketRequest(client, 'say defaultRoom I should not hear myself' + '\r\n')
        let response = await makeSocketRequest(client, '')
        // there will be the say response, but no message
        expect(response.room).toBeUndefined()
        resolve()
      })
    })

    test('I can get my id', async () => {
      let response = await makeSocketRequest(client, 'detailsView')
      expect(response.status).toEqual('OK')
      expect(response.data.remoteIP).toEqual('127.0.0.1')
    })

    describe('custom room member data', () => {
      let currentSanitize
      let currentGenerate

      beforeAll(async () => {
        // Ensure that default behavior works
        await makeSocketRequest(client2, 'roomAdd defaultRoom')
        let response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).toEqual('defaultRoom')
        for (let key in response.data.members) {
          expect(response.data.members[key].type).toBeUndefined()
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

      afterAll(() => {
        api.chatRoom.joinCallbacks = {}
        api.chatRoom.leaveCallbacks = {}

        api.chatRoom.sanitizeMemberDetails = currentSanitize
        api.chatRoom.generateMemberDetails = currentGenerate
      })

      test('should view non-default member data', async () => {
        await makeSocketRequest(client2, 'roomAdd defaultRoom')
        let response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).toEqual('defaultRoom')
        for (let key in response.data.members) {
          expect(response.data.members[key].type).toEqual('socket')
        }
        await makeSocketRequest(client2, 'roomLeave defaultRoom')
      })
    })

    test('Folks are notified when I join a room', async () => {
      await makeSocketRequest(client, 'roomAdd otherRoom')
      makeSocketRequest(client2, 'roomAdd otherRoom')
      let response = await makeSocketRequest(client, '')
      expect(response.message).toEqual('I have entered the room: ' + client2Details.id)
      expect(response.from).toEqual(0)
    })

    test('Folks are notified when I leave a room', async () => {
      makeSocketRequest(client2, 'roomLeave defaultRoom\r\n')
      let response = await makeSocketRequest(client, '')
      expect(response.message).toEqual('I have left the room: ' + client2Details.id)
      expect(response.from).toEqual(0)
    })
  })

  describe('disconnect', () => {
    afterAll(async () => { await connectClients() })

    test('server can disconnect a client', async () => {
      let response = await makeSocketRequest(client, 'status')
      expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
      expect(client.readable).toEqual(true)
      expect(client.writable).toEqual(true)

      for (let id in api.connections.connections) {
        api.connections.connections[id].destroy()
      }

      await api.utils.sleep(100)

      expect(client.readable).toEqual(false)
      expect(client.writable).toEqual(false)
    })
  })
})
