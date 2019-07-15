'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: Action Cluster', () => {
  beforeAll(async () => {
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

  afterAll(async () => { await actionhero.stop() })

  describe('RPC', () => {
    afterEach(() => { delete api.rpcTestMethod })

    test(
      'can call remote methods on all other servers in the cluster',
      async () => {
        const data = {}
        api.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }
        await api.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'])
        await api.utils.sleep(100)

        expect(data[1][0]).toEqual('arg1')
        expect(data[1][1]).toEqual('arg2')
      }
    )

    test(
      'can call remote methods only on one other cluster who holds a specific connectionId',
      async () => {
        const client = await api.specHelper.Connection.createAsync()
        const data = {}
        api.rpcTestMethod = (arg1, arg2) => { data[1] = [arg1, arg2] }

        await api.redis.doCluster('api.rpcTestMethod', ['arg1', 'arg2'], client.id)
        await api.utils.sleep(100)

        expect(data[1][0]).toEqual('arg1')
        expect(data[1][1]).toEqual('arg2')
        client.destroy()
      }
    )

    test(
      'can get information about connections connected to other servers',
      async () => {
        const client = await api.specHelper.Connection.createAsync()

        const { id, type, canChat } = await api.connections.apply(client.id)
        expect(id).toEqual(client.id)
        expect(type).toEqual('testServer')
        expect(canChat).toEqual(true)
      }
    )

    test(
      'can call remote methods on/about connections connected to other servers',
      async () => {
        const client = await api.specHelper.Connection.createAsync()
        expect(client.auth).toBeUndefined()

        const connection = await api.connections.apply(client.id, 'set', ['auth', true])
        expect(connection.id).toEqual(client.id)
        expect(client.auth).toEqual(true)
        client.destroy()
      }
    )

    test(
      'can send arbitraty messages to connections connected to other servers',
      async () => {
        const client = await api.specHelper.Connection.createAsync()

        const connection = await api.connections.apply(client.id, 'sendMessage', { message: 'hi' })
        const message = connection.messages[(connection.messages.length - 1)]
        expect(message.message).toEqual('hi')
      }
    )

    test(
      'failing RPC calls with a callback will have a failure callback',
      async () => {
        try {
          await api.redis.doCluster('api.rpcTestMethod', [], 'A missing clientId', true)
          throw new Error('should not get here')
        } catch (error) {
          expect(error.toString()).toEqual('Error: RPC Timeout')
        }
      }
    )
  })
})
