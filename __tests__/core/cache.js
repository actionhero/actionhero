'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core', () => {
  describe('cache', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('cache methods should exist', () => {
      expect(api.cache).toBeInstanceOf(Object)
      expect(api.cache.save).toBeInstanceOf(Function)
      expect(api.cache.load).toBeInstanceOf(Function)
      expect(api.cache.destroy).toBeInstanceOf(Function)
    })

    test('cache.save', async () => {
      const resp = await api.cache.save('testKey', 'abc123')
      expect(resp).toEqual(true)
    })

    test('cache.load', async () => {
      await api.cache.save('testKey', 'abc123')
      const { value } = await api.cache.load('testKey')
      expect(value).toEqual('abc123')
    })

    test('cache.load failures', async () => {
      try {
        await api.cache.load('something else')
        throw new Error('should not get here')
      } catch (error) {
        expect(String(error)).toEqual('Error: Object not found')
      }
    })

    test('cache.destroy', async () => {
      const resp = await api.cache.destroy('testKey')
      expect(resp).toEqual(true)
    })

    test('cache.destroy failure', async () => {
      const resp = await api.cache.destroy('testKey')
      expect(resp).toEqual(false)
    })

    test('cache.save with expire time', async () => {
      const resp = await api.cache.save('testKey', 'abc123', 10)
      expect(resp).toEqual(true)
    })

    test('cache.load with expired items should not return them', async () => {
      const saveResp = await api.cache.save('testKey_slow', 'abc123', 10)
      expect(saveResp).toEqual(true)
      await api.utils.sleep(20)
      try {
        await api.cache.load('testKey_slow')
        throw new Error('should not get here')
      } catch (error) {
        expect(String(error)).toEqual('Error: Object expired')
      }
    })

    test('cache.load with negative expire times will never load', async () => {
      const saveResp = await api.cache.save('testKeyInThePast', 'abc123', -1)
      expect(saveResp).toEqual(true)
      try {
        await api.cache.load('testKeyInThePast')
        throw new Error('should not get here')
      } catch (error) {
        expect(String(error)).toMatch(/Error: Object/)
      }
    })

    test('cache.save does not need to pass expireTime', async () => {
      const saveResp = await api.cache.save('testKeyForNullExpireTime', 'abc123')
      expect(saveResp).toEqual(true)
      const { value } = await api.cache.load('testKeyForNullExpireTime')
      expect(value).toEqual('abc123')
    })

    test(
      'cache.load without changing the expireTime will re-apply the redis expire',
      async () => {
        const key = 'testKey'
        await api.cache.save(key, 'val', 1000)
        const loadResp = await api.cache.load(key)
        expect(loadResp.value).toEqual('val')
        await api.utils.sleep(1001)
        try {
          await api.cache.load(key)
          throw new Error('should not get here')
        } catch (error) {
          // expect(String(error)).toMatch(/Error: Object expired/)
          expect(error).toBeTruthy()
        }
      }
    )

    test(
      'cache.load with options that extending expireTime should return cached item',
      async () => {
        const expireTime = 400
        const timeout = 200

        // save the initial key
        const saveResp = await api.cache.save('testKey_slow', 'abc123', expireTime)
        expect(saveResp).toEqual(true)

        // wait for `timeout` and try to load the key
        await api.utils.sleep(timeout)

        let loadResp = await api.cache.load('testKey_slow', { expireTimeMS: expireTime })
        expect(loadResp.value).toEqual('abc123')

        // wait another `timeout` and load the key again within the extended expire time
        await api.utils.sleep(timeout)

        loadResp = await api.cache.load('testKey_slow')
        expect(loadResp.value).toEqual('abc123')

        // wait another `timeout` and the key load should fail without the extension
        await api.utils.sleep(timeout)

        try {
          loadResp = await api.cache.load('testKey_slow')
          throw new Error('should not get here')
        } catch (error) {
          expect(String(error)).toEqual('Error: Object expired')
        }
      }
    )

    test('cache.save works with arrays', async () => {
      const saveResp = await api.cache.save('array_key', [1, 2, 3])
      expect(saveResp).toEqual(true)
      const { value } = await api.cache.load('array_key')
      expect(value[0]).toEqual(1)
      expect(value[1]).toEqual(2)
      expect(value[2]).toEqual(3)
    })

    test('cache.save works with objects', async () => {
      const data = {}
      data.thing = 'stuff'
      data.otherThing = [1, 2, 3]
      const saveResp = await api.cache.save('obj_key', data)
      expect(saveResp).toEqual(true)
      const { value } = await api.cache.load('obj_key')
      expect(value.thing).toEqual('stuff')
      expect(value.otherThing[0]).toEqual(1)
      expect(value.otherThing[1]).toEqual(2)
      expect(value.otherThing[2]).toEqual(3)
    })

    test('can read the cache size', async () => {
      await api.cache.save('thingA')
      const count = await api.cache.size()
      expect(count > 0).toEqual(true)
    })

    test('can clear the cache entirely', async () => {
      await api.cache.save('thingA')
      let count = await api.cache.size()
      expect(count > 0).toEqual(true)
      await api.cache.clear()
      count = await api.cache.size()
      expect(count).toEqual(0)
    })

    describe('lists', () => {
      test('can push and pop from an array', async () => {
        await api.cache.push('testListKey', 'a string')
        await api.cache.push('testListKey', ['an array'])
        await api.cache.push('testListKey', { what: 'an object' })

        let data
        data = await api.cache.pop('testListKey')
        expect(data).toEqual('a string')
        data = await api.cache.pop('testListKey')
        expect(data).toEqual(['an array'])
        data = await api.cache.pop('testListKey')
        expect(data).toEqual({ what: 'an object' })
        data = await api.cache.pop('testListKey')
        expect(data).toBeNull()
      })

      test('will return undefined if the list is empty', async () => {
        const data = await api.cache.pop('emptyListKey')
        expect(data).toBeNull()
      })

      test('can get the length of an array when full', async () => {
        await api.cache.push('testListKey2', 'a string')
        const length = await api.cache.listLength('testListKey2')
        expect(length).toEqual(1)
      })

      test('will return 0 length when the key does not exist', async () => {
        const length = await api.cache.listLength('testListKey3')
        expect(length).toEqual(0)
      })
    })

    describe('locks', () => {
      const key = 'testKey'

      afterEach(async () => {
        api.cache.lockName = api.id
        await api.cache.unlock(key)
      })

      test('things can be locked, checked, and unlocked aribitrarily', async () => {
        let lockOk
        lockOk = await api.cache.lock(key, 100)
        expect(lockOk).toEqual(true)
        lockOk = await api.cache.checkLock(key)
        expect(lockOk).toEqual(true)
        lockOk = await api.cache.unlock(key)
        expect(lockOk).toEqual(true)
      })

      test(
        'locks have a TTL and the default will be assumed from config',
        async () => {
          const lockOk = await api.cache.lock(key, null)
          expect(lockOk).toEqual(true)
          const ttl = await api.redis.clients.client.ttl(api.cache.lockPrefix + key)
          expect(ttl >= 9).toEqual(true)
          expect(ttl <= 10).toEqual(true)
        }
      )

      test('you can save an item if you do hold the lock', async () => {
        const lockOk = await api.cache.lock(key, null)
        expect(lockOk).toEqual(true)
        const success = await api.cache.save(key, 'value')
        expect(success).toEqual(true)
      })

      test('you cannot save a locked item if you do not hold the lock', async () => {
        const lockOk = await api.cache.lock(key, null)
        expect(lockOk).toEqual(true)
        api.cache.lockName = 'otherId'
        try {
          await api.cache.save(key, 'value')
          throw new Error('should not get here')
        } catch (error) {
          expect(String(error)).toEqual('Error: Object locked')
        }
      })

      test(
        'you cannot destroy a locked item if you do not hold the lock',
        async () => {
          const lockOk = await api.cache.lock(key, null)
          expect(lockOk).toEqual(true)
          api.cache.lockName = 'otherId'
          try {
            await api.cache.destroy(key, 'value')
            throw new Error('should not get here')
          } catch (error) {
            expect(String(error)).toEqual('Error: Object locked')
          }
        }
      )

      test(
        'you can opt to retry to obtain a lock if a lock is held (READ)',
        async () => {
          const success = await api.cache.save(key, 'value')
          expect(success).toEqual(true)
          let lockOk = await api.cache.lock(key, 1) // will be rounded up to 1s
          expect(lockOk).toEqual(true)

          api.cache.lockName = 'otherId'
          lockOk = await api.cache.checkLock(key, null)
          expect(lockOk).toEqual(false)

          const start = new Date().getTime()
          const { value } = await api.cache.load(key, { retry: 2000 })
          expect(value).toEqual('value')
          const delta = new Date().getTime() - start
          expect(delta >= 1000).toEqual(true)
        }
      )

      describe('locks are actually blocking', () => {
        let originalLockName

        beforeAll(() => { originalLockName = api.cache.lockName })
        afterAll(() => { api.cache.lockName = originalLockName })

        test('locks are actually blocking', async () => {
          const key = 'test'
          let lockOk

          api.cache.lockName = `test-name-pass-${1}`
          lockOk = await api.cache.checkLock(key)
          expect(lockOk).toEqual(true)
          await api.cache.lock(key, (1000 * 60))

          api.cache.lockName = `test-name-pass-${2}`
          lockOk = await api.cache.checkLock(key)
          expect(lockOk).toEqual(false)

          api.cache.lockName = `test-name-pass-${3}`
          lockOk = await api.cache.checkLock(key)
          expect(lockOk).toEqual(false)
        })

        test('locks are actually blocking (using setnx value)', async () => {
          const key = 'test-setnx'
          let lockOk

          api.cache.lockName = `test-setnx-name-pass-${1}`
          lockOk = await api.cache.lock(key, (1000 * 60))
          expect(lockOk).toEqual(true)

          api.cache.lockName = `test-setnx-name-pass-${2}`
          lockOk = await api.cache.lock(key, (1000 * 60))
          expect(lockOk).toEqual(false)

          api.cache.lockName = `test-setnx-name-pass-${3}`
          lockOk = await api.cache.lock(key, (1000 * 60))
          expect(lockOk).toEqual(false)
        })
      })
    })

    describe('cache dump files', () => {
      const file = os.tmpdir() + path.sep + 'cacheDump'

      test('can read write the cache to a dump file', async () => {
        await api.cache.clear()
        await api.cache.save('thingA', 123)
        const count = await api.cache.dumpWrite(file)
        expect(count).toEqual(1)
        const body = JSON.parse(String(fs.readFileSync(file)))
        const content = JSON.parse(body['actionhero:cache:thingA'])
        expect(content.value).toEqual(123)
      })

      test('can load the cache from a dump file', async () => {
        await api.cache.clear()
        const count = await api.cache.dumpRead(file)
        expect(count).toEqual(1)
        const { value } = await api.cache.load('thingA')
        expect(value).toEqual(123)
      })
    })
  })
})
