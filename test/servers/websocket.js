'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

let clientA
let clientB
let clientC

let url

const connectClients = async () => {
  // get ActionheroWebsocketClient in scope
  const ActionheroWebsocketClient = eval(api.servers.servers.websocket.compileActionheroWebsocketClientJS()) // eslint-disable-line

  let S = api.servers.servers.websocket.server.Socket
  url = 'http://localhost:' + api.config.servers.web.port
  let clientAsocket = new S(url)
  let clientBsocket = new S(url)
  let clientCsocket = new S(url)

  clientA = new ActionheroWebsocketClient({}, clientAsocket) // eslint-disable-line
  clientB = new ActionheroWebsocketClient({}, clientBsocket) // eslint-disable-line
  clientC = new ActionheroWebsocketClient({}, clientCsocket) // eslint-disable-line

  await sleep(100)
}

const awaitMethod = async (client, method, returnsError) => {
  if (!returnsError) { returnsError = false }
  return new Promise((resolve, reject) => {
    client[method]((a, b) => {
      if (returnsError && a) { return reject(a) }
      if (returnsError) { return resolve(b) }
      return resolve(a)
    })
  })
}

const awaitAction = async (client, action, params) => {
  if (!params) { params = {} }
  return new Promise((resolve) => {
    client.action(action, params, (response) => {
      return resolve(response)
    })
  })
}

const awaitFile = async (client, file) => {
  return new Promise((resolve) => {
    client.file(file, (response) => {
      return resolve(response)
    })
  })
}

const awaitRoom = async (client, method, room) => {
  return new Promise((resolve) => {
    client[method](room, (response) => {
      return resolve(response)
    })
  })
}

describe('Server: Web Socket', () => {
  before(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
    api.config.servers.websocket.clientUrl = url
    await connectClients()
  })

  after(async () => { await actionhero.stop() })

  it('socket client connections should work: client 1', async () => {
    let data = await awaitMethod(clientA, 'connect', true)
    expect(data.context).to.equal('response')
    expect(data.data.totalActions).to.equal(0)
    expect(clientA.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
  })

  it('socket client connections should work: client 2', async () => {
    let data = await awaitMethod(clientB, 'connect', true)
    expect(data.context).to.equal('response')
    expect(data.data.totalActions).to.equal(0)
    expect(clientB.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
  })

  it('socket client connections should work: client 3', async () => {
    let data = await awaitMethod(clientC, 'connect', true)
    expect(data.context).to.equal('response')
    expect(data.data.totalActions).to.equal(0)
    expect(clientC.welcomeMessage).to.equal('Hello! Welcome to the actionhero api')
  })

  describe('with connection', () => {
    before(async () => {
      await awaitMethod(clientA, 'connect', true)
      await awaitMethod(clientB, 'connect', true)
      await awaitMethod(clientC, 'connect', true)
    })

    it('I can get my connection details', async () => {
      let response = await awaitMethod(clientA, 'detailsView')
      expect(response.data.connectedAt).to.be.below(new Date().getTime())
      expect(response.data.remoteIP).to.equal('127.0.0.1')
    })

    it('can run actions with errors', async () => {
      let response = await awaitAction(clientA, 'cacheTest')
      expect(response.error).to.equal('key is a required parameter for this action')
    })

    it('properly handles duplicate room commands at the same time', async () => {
      awaitRoom(clientA, 'roomAdd', 'defaultRoom')
      awaitRoom(clientA, 'roomAdd', 'defaultRoom')

      await sleep(500)

      expect(clientA.rooms).to.deep.equal(['defaultRoom'])
    })

    it('properly responds with messageCount', async () => {
      let aTime
      let bTime
      let startingMessageCount = clientA.messageCount
      awaitRoom(clientA, 'roomAdd', 'defaultRoom') // fast
      let responseA = awaitAction(clientA, 'sleepTest') // slow
      awaitRoom(clientA, 'roomAdd', 'defaultRoom') // fast
      let responseB = awaitAction(clientA, 'randomNumber') // fast

      responseA.then((data) => {
        responseA = data
        aTime = new Date()
      })

      responseB.then((data) => {
        responseB = data
        bTime = new Date()
      })

      await sleep(2001)

      expect(responseA.messageCount).to.equal(startingMessageCount + 2)
      expect(responseB.messageCount).to.equal(startingMessageCount + 4)
      expect(aTime.getTime()).to.be.above(bTime.getTime())
    })

    it('can run actions properly without params', async () => {
      let response = await awaitAction(clientA, 'randomNumber')
      expect(response.error).to.not.exist()
      expect(response.randomNumber).to.exist()
    })

    it('can run actions properly with params', async () => {
      let response = await awaitAction(clientA, 'cacheTest', {key: 'test key', value: 'test value'})
      expect(response.error).to.not.exist()
      expect(response.cacheTestResults).to.exist()
    })

    it('does not have sticky params', async () => {
      let response = await awaitAction(clientA, 'cacheTest', {key: 'test key', value: 'test value'})
      expect(response.cacheTestResults.loadResp.key).to.equal('cacheTest_test key')
      expect(response.cacheTestResults.loadResp.value).to.equal('test value')
      let responseAgain = await awaitAction(clientA, 'cacheTest')
      expect(responseAgain.error).to.equal('key is a required parameter for this action')
    })

    it('will limit how many simultaneous connections I can have', async () => {
      let responses = []
      clientA.action('sleepTest', {sleepDuration: 100}, (response) => { responses.push(response) })
      clientA.action('sleepTest', {sleepDuration: 200}, (response) => { responses.push(response) })
      clientA.action('sleepTest', {sleepDuration: 300}, (response) => { responses.push(response) })
      clientA.action('sleepTest', {sleepDuration: 400}, (response) => { responses.push(response) })
      clientA.action('sleepTest', {sleepDuration: 500}, (response) => { responses.push(response) })
      clientA.action('sleepTest', {sleepDuration: 600}, (response) => { responses.push(response) })

      await sleep(1000)

      expect(responses).to.have.length(6)
      for (let i in responses) {
        let response = responses[i]
        if (i === 0 || i === '0') {
          expect(response.error).to.equal('you have too many pending requests')
        } else {
          expect(response.error).to.not.exist()
        }
      }
    })

    describe('files', () => {
      it('can request file data', async () => {
        let data = await awaitFile(clientA, 'simple.html')
        expect(data.error).to.not.exist()
        expect(data.content).to.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        expect(data.mime).to.equal('text/html')
        expect(data.length).to.equal(101)
      })

      it('missing files', async () => {
        let data = await awaitFile(clientA, 'missing.html')
        expect(data.error).to.equal('That file is not found')
        expect(data.mime).to.equal('text/html')
        expect(data.content).to.be.null()
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
            api.chatRoom.broadcast({}, room, `I have left the room: ${connection.id}`)
          }
        })
      })

      after(() => {
        api.chatRoom.middleware = {}
        api.chatRoom.globalMiddleware = []
      })

      beforeEach(async () => {
        await awaitRoom(clientA, 'roomAdd', 'defaultRoom')
        await awaitRoom(clientB, 'roomAdd', 'defaultRoom')
        await awaitRoom(clientC, 'roomAdd', 'defaultRoom')
        // timeout to skip welcome messages as clients join rooms
        await sleep(100)
      })

      afterEach(async () => {
        await awaitRoom(clientA, 'roomLeave', 'defaultRoom')
        await awaitRoom(clientB, 'roomLeave', 'defaultRoom')
        await awaitRoom(clientC, 'roomLeave', 'defaultRoom')
        await awaitRoom(clientA, 'roomLeave', 'otherRoom')
        await awaitRoom(clientB, 'roomLeave', 'otherRoom')
        await awaitRoom(clientC, 'roomLeave', 'otherRoom')
      })

      it('can change rooms and get room details', async () => {
        await awaitRoom(clientA, 'roomAdd', 'otherRoom')
        let response = await awaitMethod(clientA, 'detailsView')
        expect(response.error).to.not.exist()
        expect(response.data.rooms[0]).to.equal('defaultRoom')
        expect(response.data.rooms[1]).to.equal('otherRoom')

        let roomResponse = await awaitRoom(clientA, 'roomView', 'otherRoom')
        expect(roomResponse.data.membersCount).to.equal(1)
      })

      it('will update client room info when they change rooms', async () => {
        expect(clientA.rooms[0]).to.equal('defaultRoom')
        expect(clientA.rooms[1]).to.not.exist()
        let response = await awaitRoom(clientA, 'roomAdd', 'otherRoom')
        expect(response.error).to.not.exist()
        expect(clientA.rooms[0]).to.equal('defaultRoom')
        expect(clientA.rooms[1]).to.equal('otherRoom')

        let leaveResponse = await awaitRoom(clientA, 'roomLeave', 'defaultRoom')
        expect(leaveResponse.error).to.not.exist()
        expect(clientA.rooms[0]).to.equal('otherRoom')
        expect(clientA.rooms[1]).to.not.exist()
      })

      it('clients can talk to each other', async () => {
        await new Promise((resolve) => {
          let listener = (response) => {
            clientA.removeListener('say', listener)
            expect(response.context).to.equal('user')
            expect(response.message).to.equal('hello from client 2')
            resolve()
          }

          clientA.on('say', listener)
          clientB.say('defaultRoom', 'hello from client 2')
        })
      })

      it('The client say method does not rely on argument order', async () => {
        await new Promise((resolve) => {
          let listener = (response) => {
            clientA.removeListener('say', listener)
            expect(response.context).to.equal('user')
            expect(response.message).to.equal('hello from client 2')
            resolve()
          }

          clientB.say = (room, message) => {
            clientB.send({message: message, room: room, event: 'say'})
          }

          clientA.on('say', listener)
          clientB.say('defaultRoom', 'hello from client 2')
        })
      })

      it('connections are notified when I join a room', async () => {
        await new Promise((resolve) => {
          let listener = (response) => {
            clientA.removeListener('say', listener)
            expect(response.context).to.equal('user')
            expect(response.message).to.equal('I have entered the room: ' + clientB.id)
            resolve()
          }

          clientA.roomAdd('otherRoom', () => {
            clientA.on('say', listener)
            clientB.roomAdd('otherRoom')
          })
        })
      })

      it('connections are notified when I leave a room', async () => {
        await new Promise((resolve) => {
          let listener = (response) => {
            clientA.removeListener('say', listener)
            expect(response.context).to.equal('user')
            expect(response.message).to.equal('I have left the room: ' + clientB.id)
            resolve()
          }

          clientA.on('say', listener)
          clientB.roomLeave('defaultRoom')
        })
      })

      it('will not get messages for rooms I am not in', async () => {
        let response = await awaitRoom(clientB, 'roomAdd', 'otherRoom')
        expect(response.error).to.not.exist()
        expect(clientB.rooms.length).to.equal(2)
        expect(clientC.rooms.length).to.equal(1)

        await new Promise(async (resolve, reject) => {
          let listener = (response) => {
            clientC.removeListener('say', listener)
            reject(new Error('should not get here'))
          }

          clientC.on('say', listener)

          clientB.say('otherRoom', 'you should not hear this')
          await sleep(1000)
          clientC.removeListener('say', listener)
          resolve()
        })
      })

      it('connections can see member counts changing within rooms as folks join and leave', async () => {
        let response = await awaitRoom(clientA, 'roomView', 'defaultRoom')
        expect(response.data.membersCount).to.equal(3)
        await awaitRoom(clientB, 'roomLeave', 'defaultRoom')
        let responseAgain = await awaitRoom(clientA, 'roomView', 'defaultRoom')
        expect(responseAgain.data.membersCount).to.equal(2)
      })

      describe('middleware - say and onSayReceive', () => {
        afterEach(() => {
          api.chatRoom.middleware = {}
          api.chatRoom.globalMiddleware = []
        })

        it('each listener receive custom message', async () => {
          let messagesReceived = 0
          api.chatRoom.addMiddleware({
            name: 'say for each',
            say: async (connection, room, messagePayload) => {
              messagePayload.message += ' - To: ' + connection.id
              return messagePayload
            }
          })

          let listenerA = (response) => {
            messagesReceived++
            clientA.removeListener('say', listenerA)
            expect(response.message).to.equal('Test Message - To: ' + clientA.id) // clientA.id (Receiever)
          }

          let listenerB = (response) => {
            messagesReceived++
            clientB.removeListener('say', listenerB)
            expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Receiever)
          }

          let listenerC = (response) => {
            messagesReceived++
            clientC.removeListener('say', listenerC)
            expect(response.message).to.equal('Test Message - To: ' + clientC.id) // clientC.id (Receiever)
          }

          clientA.on('say', listenerA)
          clientB.on('say', listenerB)
          clientC.on('say', listenerC)
          clientB.say('defaultRoom', 'Test Message')

          await sleep(1000)

          expect(messagesReceived).to.equal(3)
        })

        it('only one message should be received per connection', async () => {
          let firstSayCall = true
          api.chatRoom.addMiddleware({
            name: 'first say middleware',
            say: async (connection, room, messagePayload) => {
              if (firstSayCall) {
                firstSayCall = false
                await sleep(200)
              }
            }
          })

          let messagesReceived = 0
          let listenerA = () => {
            clientA.removeListener('say', listenerA)
            messagesReceived += 1
          }

          let listenerB = () => {
            clientB.removeListener('say', listenerB)
            messagesReceived += 2
          }

          let listenerC = () => {
            clientC.removeListener('say', listenerC)
            messagesReceived += 4
          }

          clientA.on('say', listenerA)
          clientB.on('say', listenerB)
          clientC.on('say', listenerC)
          clientB.say('defaultRoom', 'Test Message')

          await sleep(1000)

          expect(messagesReceived).to.equal(7)
        })

        it('each listener receive same custom message', async () => {
          let messagesReceived = 0
          api.chatRoom.addMiddleware({
            name: 'say for each',
            onSayReceive: (connection, room, messagePayload) => {
              messagePayload.message += ' - To: ' + connection.id
              return messagePayload
            }
          })

          let listenerA = (response) => {
            messagesReceived++
            clientA.removeListener('say', listenerA)
            expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
          }

          let listenerB = (response) => {
            messagesReceived++
            clientB.removeListener('say', listenerB)
            expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
          }

          let listenerC = (response) => {
            messagesReceived++
            clientC.removeListener('say', listenerC)
            expect(response.message).to.equal('Test Message - To: ' + clientB.id) // clientB.id (Sender)
          }

          clientA.on('say', listenerA)
          clientB.on('say', listenerB)
          clientC.on('say', listenerC)
          clientB.say('defaultRoom', 'Test Message')

          await sleep(1000)

          expect(messagesReceived).to.equal(3)
        })
      })

      describe('custom room member data', () => {
        let currentSanitize
        let currentGenerate

        before(async () => {
          // Ensure that default behavior works
          await awaitRoom(clientA, 'roomAdd', 'defaultRoom')
          let response = await awaitRoom(clientA, 'roomView', 'defaultRoom')
          expect(response.data.room).to.equal('defaultRoom')

          for (let key in response.data.members) {
            expect(response.data.members[key].type).to.not.exist()
          }

          // save off current methods
          currentSanitize = api.chatRoom.sanitizeMemberDetails
          currentGenerate = api.chatRoom.generateMemberDetails

          // override methods
          api.chatRoom.sanitizeMemberDetails = (connection) => {
            return {
              id: connection.id,
              joinedAt: connection.joinedAt,
              type: connection.type,
              fromSanitize: true
            }
          }

          api.chatRoom.generateMemberDetails = (connection) => {
            return {
              id: connection.id,
              joinedAt: new Date().getTime(),
              type: connection.type,
              fromGet: true
            }
          }

          await awaitRoom(clientA, 'roomLeave', 'defaultRoom')
        })

        after(() => {
          api.chatRoom.joinCallbacks = {}
          api.chatRoom.leaveCallbacks = {}

          api.chatRoom.sanitizeMemberDetails = currentSanitize
          api.chatRoom.generateMemberDetails = currentGenerate
        })

        it('should view non-default member data when overwritten', async () => {
          await awaitRoom(clientA, 'roomAdd', 'defaultRoom')
          let response = await awaitRoom(clientA, 'roomView', 'defaultRoom')
          expect(response.data.room).to.equal('defaultRoom')

          for (let key in response.data.members) {
            expect(response.data.members[key].type).to.equal('websocket')
            expect(response.data.members[key].fromSanitize).to.equal(true)
          }

          await awaitRoom(clientA, 'roomLeave', 'defaultRoom')
        })
      })
    })

    describe('param collisions', () => {
      let originalSimultaneousActions

      before(() => {
        originalSimultaneousActions = api.config.general.simultaneousActions
        api.config.general.simultaneousActions = 99999999
      })

      after(() => {
        api.config.general.simultaneousActions = originalSimultaneousActions
      })

      it('will not have param colisions', async () => {
        let completed = 0
        let started = 0
        let sleeps = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]

        await new Promise((resolve) => {
          let toComplete = (sleep, response) => {
            expect(sleep).to.equal(response.sleepDuration)
            completed++
            if (completed === started) { resolve() }
          }

          sleeps.forEach((sleep) => {
            started++
            clientA.action('sleepTest', {sleepDuration: sleep}, (response) => { toComplete(sleep, response) })
          })
        })
      })
    })

    describe('disconnect', () => {
      beforeEach(async () => {
        try {
          clientA.disconnect()
          clientB.disconnect()
          clientC.disconnect()
        } catch (e) {}

        await connectClients()
        clientA.connect()
        clientB.connect()
        clientC.connect()
        await sleep(500)
      })

      it('client can disconnect', async () => {
        expect(api.servers.servers.websocket.connections().length).to.equal(3)

        clientA.disconnect()
        clientB.disconnect()
        clientC.disconnect()

        await sleep(500)

        expect(api.servers.servers.websocket.connections().length).to.equal(0)
      })

      it('can be sent disconnect events from the server', async () => {
        let response = await awaitMethod(clientA, 'detailsView')
        expect(response.data.remoteIP).to.equal('127.0.0.1')

        let count = 0
        for (let id in api.connections.connections) {
          count++
          api.connections.connections[id].destroy()
        }
        expect(count).to.equal(3)

        clientA.detailsView(() => {
          throw new Error('should not get response')
        })

        await sleep(500)
      })
    })
  })
})
