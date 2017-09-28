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

describe('Core: Action Cluster', () => {
  before(async () => {
    api = await actionhero.start()
    for (var room in api.config.general.startingChatRooms) {
      try {
        await api.chatRoom.destroy(room)
        await api.chatRoom.add(room)
      } catch (error) {
        if (!error.toString().match(api.config.errors.connectionRoomExists(room))) { throw error }
      }
    }
  })

  after(async () => { await actionhero.stop() })

  describe('RPC', () => {
    afterEach(() => { delete api.rpcTestMethod })

    it('can call remote methods on all other servers in the cluster', async () => {
      let data = {}
      api.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }
      await api.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'])
      await sleep(100)

      expect(data[1][0]).to.equal('arg1')
      expect(data[1][1]).to.equal('arg2')
    })

    it('can call remote methods only on one other cluster who holds a specific connectionId', async () => {
      let client = new api.specHelper.Connection()
      let data = {}
      api.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }

      await api.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id)
      await sleep(100)

      expect(data[1][0]).to.equal('arg1')
      expect(data[1][1]).to.equal('arg2')
      client.destroy()
    })

    it('can get information about connections connected to other servers', async () => {
      let client = new api.specHelper.Connection()

      let {id, type, canChat} = await api.connections.apply(client.id)
      expect(id).to.equal(client.id)
      expect(type).to.equal('testServer')
      expect(canChat).to.equal(true)
    })

    it('can call remote methods on/about connections connected to other servers', async () => {
      let client = new api.specHelper.Connection()
      expect(client.auth).to.not.exist()

      let connection = await api.connections.apply(client.id, 'set', ['auth', true])
      expect(connection.id).to.equal(client.id)
      expect(client.auth).to.equal(true)
      client.destroy()
    })

    it('can send arbitraty messages to connections connected to other servers', async () => {
      let client = new api.specHelper.Connection()

      let connection = await api.connections.apply(client.id, 'sendMessage', {message: 'hi'})
      let message = connection.messages[(connection.messages.length - 1)]
      expect(message.message).to.equal('hi')
    })

    it('failing RPC calls with a callback will have a failure callback', async () => {
      try {
        await api.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', true)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.equal('Error: RPC Timeout')
      }
    })
  })
})
