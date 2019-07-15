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

const makeSocketRequest = async (thisClient, message = '', delimiter = '\r\n') => {
  let data = ''
  let response
  return new Promise((resolve) => {
    const onData = (d) => {
      data += d
      const lines = data.split(delimiter)
      while (lines.length > 0) {
        const attemptedLine = lines.pop()
        try {
          response = JSON.parse(attemptedLine)
          thisClient.removeAllListeners('data')
          return resolve(response)
        } catch (error) {
          // keep trying
        }
      }
    }

    thisClient.write(message + delimiter)
    thisClient.on('data', onData)
  })
}

const buildClient = () => {
  return new Promise((resolve) => {
    const conn = net.connect(api.config.servers.socket.port)
    conn.data = ''
    conn.on('connect', () => {
      conn.setEncoding('utf8')
      return resolve(conn)
    })
  })
}

const connectClients = async () => {
  client = await buildClient()
  client2 = await buildClient()
  client3 = await buildClient()

  // wait for welcome messages
  await makeSocketRequest(client)
  await makeSocketRequest(client2)
  await makeSocketRequest(client3)
}

describe('Server: Socket', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    await connectClients()
    const result = await makeSocketRequest(client2, 'detailsView')
    client2Details = result.data
  })

  afterAll(async () => {
    client.end()
    client2.end()
    client3.end()
    await actionhero.stop()
  })

  test('socket connections should be able to connect and get JSON', async () => {
    const response = await makeSocketRequest(client, 'hello')
    expect(response).toBeInstanceOf(Object)
    expect(response.error).toEqual('unknown action or invalid apiVersion')
  })

  test('single string message are treated as actions', async () => {
    const response = await makeSocketRequest(client, 'status')
    expect(response).toBeInstanceOf(Object)
    expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
  })

  test('stringified JSON can also be sent as actions', async () => {
    const response = await makeSocketRequest(client, JSON.stringify({ action: 'status', params: { something: 'else' } }))
    expect(response).toBeInstanceOf(Object)
    expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
  })

  test('really long messages are OK', async () => {
    const msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    const response = await makeSocketRequest(client, JSON.stringify(msg))
    expect(response.cacheTestResults.loadResp.key).toEqual('cacheTest_' + msg.params.key)
    expect(response.cacheTestResults.loadResp.value).toEqual(msg.params.value)
  })

  test('I can get my ip', async () => {
    const response = await makeSocketRequest(client, 'detailsView')
    expect(response.status).toEqual('OK')
    expect(response.data.remoteIP).toEqual('127.0.0.1')
  })

  test('I can get my details', async () => {
    const response = await makeSocketRequest(client2, 'detailsView')
    const now = new Date().getTime()
    expect(response.status).toEqual('OK')
    expect(response.data).toBeInstanceOf(Object)
    expect(response.data.params).toBeInstanceOf(Object)
    expect(response.data.connectedAt).toBeGreaterThanOrEqual(now - 5000)
    expect(response.data.connectedAt).toBeLessThan(now)
    expect(response.data.id).toEqual(response.data.fingerprint)
    client2Details = response.data // save for later!
  })

  test('params can be updated', async () => {
    const response = await makeSocketRequest(client, 'paramAdd key=otherKey')
    expect(response.status).toEqual('OK')
    const responseAgain = await makeSocketRequest(client, 'paramsView')
    expect(responseAgain.data.key).toEqual('otherKey')
  })

  test(
    'actions will fail without proper params set to the connection',
    async () => {
      await makeSocketRequest(client, 'paramDelete key')
      const response = await makeSocketRequest(client, 'cacheTest')
      expect(response.error).toEqual('key is a required parameter for this action')
    }
  )

  test('a new param can be added and viewed', async () => {
    const response = await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    expect(response.status).toEqual('OK')
    const viewResponse = await makeSocketRequest(client, 'paramView key')
    expect(viewResponse.data).toEqual('socketTestKey')
  })

  test('another new param can be added and viewed', async () => {
    const response = await makeSocketRequest(client, 'paramAdd value=abc123')
    expect(response.status).toEqual('OK')
    const viewResponse = await makeSocketRequest(client, 'paramView value')
    expect(viewResponse.data).toEqual('abc123')
  })

  test('actions will work once all the needed params are added', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    const response = await makeSocketRequest(client, 'cacheTest')
    expect(response.cacheTestResults.saveResp).toEqual(true)
  })

  test('params are sticky between actions', async () => {
    await makeSocketRequest(client, 'paramAdd key=socketTestKey')
    await makeSocketRequest(client, 'paramAdd value=abc123')
    const response = await makeSocketRequest(client, 'cacheTest')
    expect(response.error).toBeUndefined()
    expect(response.cacheTestResults.loadResp.key).toEqual('cacheTest_socketTestKey')
    expect(response.cacheTestResults.loadResp.value).toEqual('abc123')

    const responseAgain = await makeSocketRequest(client, 'cacheTest')
    expect(responseAgain.cacheTestResults.loadResp.key).toEqual('cacheTest_socketTestKey')
    expect(responseAgain.cacheTestResults.loadResp.value).toEqual('abc123')
  })

  test('only params sent in a JSON block are used', async () => {
    const response = await makeSocketRequest(client, JSON.stringify({ action: 'cacheTest', params: { key: 'someOtherValue' } }))
    expect(response.error).toEqual('value is a required parameter for this action')
  })

  test('messageId is unique', async () => {
    const responseA = await makeSocketRequest(client, 'randomNumber')
    const responseB = await makeSocketRequest(client, 'randomNumber')
    expect(responseA.messageId).not.toEqual(responseB.messageId)
  })

  test('messageId is configurable (sticky params)', async () => {
    await makeSocketRequest(client, 'paramAdd messageId=aaaaaa')
    const response = await makeSocketRequest(client, 'randomNumber')
    expect(response.messageId).toEqual('aaaaaa')
    await makeSocketRequest(client, 'paramDelete messageId')
  })

  test('messageId is configurable (json)', async () => {
    const response = await makeSocketRequest(client, JSON.stringify({ action: 'randomNumber', params: { messageId: 'abc123' } }))
    expect(response.messageId).toEqual('abc123')
  })

  test('asking to quit will disconnect', async () => {
    const newClient = await buildClient()
    await makeSocketRequest(newClient) // welcome message

    expect(newClient.readable).toEqual(true)
    expect(newClient.writable).toEqual(true)
    const response = await makeSocketRequest(newClient, 'detailsView')
    expect(response.status).toEqual('OK')

    await new Promise((resolve) => {
      newClient.on('close', () => { return resolve() })
      newClient.write('quit\n')
    })

    expect(newClient.readable).toEqual(false)
    expect(newClient.writable).toEqual(false)
    newClient.end() // needed to ensure socket closed in test
  })

  test('will limit how many simultaneous connections I can have', async () => {
    const responses = []
    let msg = ''
    let i = 0

    while (i <= api.config.general.simultaneousActions) {
      msg += `${JSON.stringify({ action: 'sleepTest', sleepDuration: 100 })} \r\n`
      i++
    }

    await new Promise((resolve) => {
      const checkResponses = (data) => {
        data.split('\n').forEach((line) => {
          if (line.length > 0 && line.indexOf('welcome') < 0) { responses.push(JSON.parse(line)) }
        })

        if (responses.length >= (api.config.general.simultaneousActions + 1)) {
          client.removeListener('data', checkResponses)
          for (const i in responses) {
            const response = responses[i]
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
        const msg = {
          action: 'cacheTest',
          params: {
            key: uuid.v4(),
            value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
          }
        }

        const response = await makeSocketRequest(client, JSON.stringify(msg))
        expect(response.status).toEqual('error')
        expect(response.error).toEqual('data length is too big (64 received/449 max)')
      }
    )
  })

  describe('custom data delimiter', () => {
    afterEach(() => { api.config.servers.socket.delimiter = '\n' })

    test('will parse custom newline data delimiter', async () => {
      api.config.servers.socket.delimiter = 'xXxXxX'
      const response = await makeSocketRequest(client, JSON.stringify({ action: 'status' }), 'xXxXxX')
      expect(response.context).toEqual('response')
    })

    test('will parse custom `^]` data delimiter', async () => {
      api.config.servers.socket.delimiter = '^]'
      const response = await makeSocketRequest(client, JSON.stringify({ action: 'status' }), '^]')
      expect(response.context).toEqual('response')
    })
  })

  describe('chat', () => {
    beforeEach(async () => {
      await makeSocketRequest(client, 'roomAdd defaultRoom')
      await makeSocketRequest(client2, 'roomAdd defaultRoom')
      await makeSocketRequest(client3, 'roomAdd defaultRoom')
    })

    afterEach(async () => {
      for (const room of ['defaultRoom', 'otherRoom']) {
        await makeSocketRequest(client, 'roomLeave ' + room)
        await makeSocketRequest(client2, 'roomLeave ' + room)
        await makeSocketRequest(client3, 'roomLeave ' + room)
      }
    })

    test('clients are in the default room', async () => {
      const response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.room).toEqual('defaultRoom')
    })

    test('clients can view additional info about rooms they are in', async () => {
      const response = await makeSocketRequest(client, 'roomView defaultRoom')
      expect(response.data.membersCount).toEqual(3)
    })

    test(
      'clients see an appropriate error when viewing rooms they are not in',
      async () => {
        const response = await makeSocketRequest(client, 'roomView notARoom')
        expect(response.error).toMatch(/connection not in this room/)
      }
    )

    test('rooms can be changed', async () => {
      await makeSocketRequest(client, 'roomAdd otherRoom')
      const response = await makeSocketRequest(client, 'roomLeave defaultRoom')
      expect(response.status).toEqual('OK')
      const responseAgain = await makeSocketRequest(client, 'roomView otherRoom')
      expect(responseAgain.data.room).toEqual('otherRoom')
      expect(responseAgain.data.membersCount).toEqual(1)
    })

    test('connections in the first room see the count go down', async () => {
      await makeSocketRequest(client, 'roomAdd   otherRoom')
      await makeSocketRequest(client, 'roomLeave defaultRoom')
      const response = await makeSocketRequest(client2, 'roomView defaultRoom')
      expect(response.data.room).toEqual('defaultRoom')
      expect(response.data.membersCount).toEqual(2)
    })

    test('folks in my room hear what I say (and say works)', async () => {
      makeSocketRequest(client2, 'say defaultRoom hello?' + '\r\n')
      const response = await makeSocketRequest(client3, '')
      expect(response.message).toEqual('hello?')
    })

    describe('chat middleware', () => {
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

      beforeEach(async () => {
        await api.utils.sleep(100) // wait sufficently long for other room ops to complete
      })

      afterAll(() => {
        api.chatRoom.middleware = {}
        api.chatRoom.globalMiddleware = []
      })

      test('Folks are notified when I join a room', async () => {
        await makeSocketRequest(client, 'roomAdd otherRoom')
        await api.utils.sleep(100) // wait sufficently long for other room ops to complete
        makeSocketRequest(client2, 'roomAdd otherRoom')
        const response = await makeSocketRequest(client, '')
        expect(response.message).toEqual('I have entered the room: ' + client2Details.id)
        expect(response.from).toEqual(0)
      })

      test('Folks are notified when I leave a room', async () => {
        makeSocketRequest(client2, 'roomLeave defaultRoom\r\n')
        const response = await makeSocketRequest(client, '')
        expect(response.message).toEqual('I have left the room: ' + client2Details.id)
        expect(response.from).toEqual(0)
      })
    })

    // test('folks not in my room do not hear what I say', async () => {
    //   await makeSocketRequest(client, 'roomLeave defaultRoom')
    //
    //   await new Promise(async (resolve) => {
    //     makeSocketRequest(client2, 'say defaultRoom you should not hear this' + '\r\n')
    //     let response = await makeSocketRequest(client, '')
    //     expect(response).toBeUndefined()
    //     resolve()
    //   })
    //
    //   await new Promise(async (resolve) => {
    //     makeSocketRequest(client, 'say defaultRoom I should not hear myself' + '\r\n')
    //     let response = await makeSocketRequest(client, '')
    //     // there will be the say response, but no message
    //     expect(response.room).toBeUndefined()
    //     resolve()
    //   })
    // })

    describe('custom room member data', () => {
      let currentSanitize
      let currentGenerate

      beforeAll(async () => {
        // Ensure that default behavior works
        await makeSocketRequest(client2, 'roomAdd defaultRoom')
        const response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).toEqual('defaultRoom')
        for (const key in response.data.members) {
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
        const response = await makeSocketRequest(client2, 'roomView defaultRoom')
        expect(response.data.room).toEqual('defaultRoom')
        for (const key in response.data.members) {
          expect(response.data.members[key].type).toEqual('socket')
        }
        await makeSocketRequest(client2, 'roomLeave defaultRoom')
      })
    })
  })

  describe('disconnect', () => {
    afterAll(async () => { await connectClients() })

    test('server can disconnect a client', async () => {
      const response = await makeSocketRequest(client, 'status')
      expect(response.id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
      expect(client.readable).toEqual(true)
      expect(client.writable).toEqual(true)

      for (const id in api.connections.connections) {
        api.connections.connections[id].destroy()
      }

      await new Promise((resolve) => {
        client.on('close', () => { return resolve() })
      })

      expect(client.readable).toEqual(false)
      expect(client.writable).toEqual(false)
    })
  })
})
