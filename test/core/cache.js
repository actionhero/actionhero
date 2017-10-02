'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const fs = require('fs')
const os = require('os')
const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: Cache', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('cache methods should exist', () => {
    expect(api.cache).to.be.instanceof(Object)
    expect(api.cache.save).to.be.instanceof(Function)
    expect(api.cache.load).to.be.instanceof(Function)
    expect(api.cache.destroy).to.be.instanceof(Function)
  })

  it('cache.save', async () => {
    let resp = await api.cache.save('testKey', 'abc123')
    expect(resp).to.equal(true)
  })

  it('cache.load', async () => {
    await api.cache.save('testKey', 'abc123')
    let { value } = await api.cache.load('testKey')
    expect(value).to.equal('abc123')
  })

  it('cache.load failures', async () => {
    try {
      await api.cache.load('something else')
      throw new Error('should not get here')
    } catch (error) {
      expect(String(error)).to.equal('Error: Object not found')
    }
  })

  it('cache.destroy', async () => {
    let resp = await api.cache.destroy('testKey')
    expect(resp).to.equal(true)
  })

  it('cache.destroy failure', async () => {
    let resp = await api.cache.destroy('testKey')
    expect(resp).to.equal(false)
  })

  it('cache.save with expire time', async () => {
    let resp = await api.cache.save('testKey', 'abc123', 10)
    expect(resp).to.equal(true)
  })

  it('cache.load with expired items should not return them', async () => {
    let saveResp = await api.cache.save('testKey_slow', 'abc123', 10)
    expect(saveResp).to.equal(true)
    await promisify(setTimeout)(20)
    try {
      await api.cache.load('testKey_slow')
      throw new Error('should not get here')
    } catch (error) {
      expect(String(error)).to.equal('Error: Object expired')
    }
  })

  it('cache.load with negative expire times will never load', async () => {
    let saveResp = await api.cache.save('testKeyInThePast', 'abc123', -1)
    expect(saveResp).to.equal(true)
    try {
      await api.cache.load('testKeyInThePast')
      throw new Error('should not get here')
    } catch (error) {
      expect(String(error)).to.match(/Error: Object/)
    }
  })

  it('cache.save does not need to pass expireTime', async () => {
    let saveResp = await api.cache.save('testKeyForNullExpireTime', 'abc123')
    expect(saveResp).to.equal(true)
    let {value} = await api.cache.load('testKeyForNullExpireTime')
    expect(value).to.equal('abc123')
  })

  it('cache.load without changing the expireTime will re-apply the redis expire', async () => {
    let key = 'testKey'
    await api.cache.save(key, 'val', 1000)
    let loadResp = await api.cache.load(key)
    expect(loadResp.value).to.equal('val')
    await promisify(setTimeout)(1001)
    try {
      await api.cache.load(key)
      throw new Error('should not get here')
    } catch (error) {
      // expect(String(error)).to.match(/Error: Object expired/)
      expect(error).to.exist()
    }
  })

  it('cache.load with options that extending expireTime should return cached item', async () => {
    let expireTime = 400
    let timeout = 200

    // save the initial key
    let saveResp = await api.cache.save('testKey_slow', 'abc123', expireTime)
    expect(saveResp).to.equal(true)

    // wait for `timeout` and try to load the key
    await promisify(setTimeout)(timeout)

    let loadResp = await api.cache.load('testKey_slow', {expireTimeMS: expireTime})
    expect(loadResp.value).to.equal('abc123')

    // wait another `timeout` and load the key again within the extended expire time
    await promisify(setTimeout)(timeout)

    loadResp = await api.cache.load('testKey_slow')
    expect(loadResp.value).to.equal('abc123')

    // wait another `timeout` and the key load should fail without the extension
    await promisify(setTimeout)(timeout)

    try {
      loadResp = await api.cache.load('testKey_slow')
      throw new Error('should not get here')
    } catch (error) {
      expect(String(error)).to.equal('Error: Object expired')
    }
  })

  it('cache.save works with arrays', async () => {
    let saveResp = await api.cache.save('array_key', [1, 2, 3])
    expect(saveResp).to.equal(true)
    let {value} = await api.cache.load('array_key')
    expect(value[0]).to.equal(1)
    expect(value[1]).to.equal(2)
    expect(value[2]).to.equal(3)
  })

  it('cache.save works with objects', async () => {
    let data = {}
    data.thing = 'stuff'
    data.otherThing = [1, 2, 3]
    let saveResp = await api.cache.save('obj_key', data)
    expect(saveResp).to.equal(true)
    let {value} = await api.cache.load('obj_key')
    expect(value.thing).to.equal('stuff')
    expect(value.otherThing[0]).to.equal(1)
    expect(value.otherThing[1]).to.equal(2)
    expect(value.otherThing[2]).to.equal(3)
  })

  it('can read the cache size', async () => {
    await api.cache.save('thingA')
    let count = await api.cache.size()
    expect(count > 0).to.equal(true)
  })

  it('can clear the cache entirely', async () => {
    await api.cache.save('thingA')
    let count = await api.cache.size()
    expect(count > 0).to.equal(true)
    await api.cache.clear()
    count = await api.cache.size()
    expect(count).to.equal(0)
  })

  describe('lists', () => {
    it('can push and pop from an array', async () => {
      await api.cache.push('testListKey', 'a string')
      await api.cache.push('testListKey', ['an array'])
      await api.cache.push('testListKey', {what: 'an object'})

      let data
      data = await api.cache.pop('testListKey')
      expect(data).to.equal('a string')
      data = await api.cache.pop('testListKey')
      expect(data).to.deep.equal(['an array'])
      data = await api.cache.pop('testListKey')
      expect(data).to.deep.equal({what: 'an object'})
      data = await api.cache.pop('testListKey')
      expect(data).to.not.exist()
    })

    it('will return undefined if the list is empty', async () => {
      let data = await api.cache.pop('emptyListKey')
      expect(data).to.not.exist()
    })

    it('can get the length of an array when full', async () => {
      await api.cache.push('testListKey2', 'a string')
      let length = await api.cache.listLength('testListKey2')
      expect(length).to.equal(1)
    })

    it('will return 0 length when the key does not exist', async () => {
      let length = await api.cache.listLength('testListKey3')
      expect(length).to.equal(0)
    })
  })

  describe('locks', () => {
    let key = 'testKey'

    afterEach(async () => {
      api.cache.lockName = api.id
      await api.cache.unlock(key)
    })

    it('things can be locked, checked, and unlocked aribitrarily', async () => {
      let lockOk
      lockOk = await api.cache.lock(key, 100)
      expect(lockOk).to.equal(true)
      lockOk = await api.cache.checkLock(key)
      expect(lockOk).to.equal(true)
      lockOk = await api.cache.unlock(key)
      expect(lockOk).to.equal(true)
    })

    it('locks have a TTL and the default will be assumed from config', async () => {
      let lockOk = await api.cache.lock(key, null)
      expect(lockOk).to.equal(true)
      let ttl = await api.redis.clients.client.ttl(api.cache.lockPrefix + key)
      expect(ttl >= 9).to.equal(true)
      expect(ttl <= 10).to.equal(true)
    })

    it('you can save an item if you do hold the lock', async () => {
      let lockOk = await api.cache.lock(key, null)
      expect(lockOk).to.equal(true)
      let success = await api.cache.save(key, 'value')
      expect(success).to.equal(true)
    })

    it('you cannot save a locked item if you do not hold the lock', async () => {
      let lockOk = await api.cache.lock(key, null)
      expect(lockOk).to.equal(true)
      api.cache.lockName = 'otherId'
      try {
        await api.cache.save(key, 'value')
        throw new Error('should not get here')
      } catch (error) {
        expect(String(error)).to.equal('Error: Object locked')
      }
    })

    it('you cannot destroy a locked item if you do not hold the lock', async () => {
      let lockOk = await api.cache.lock(key, null)
      expect(lockOk).to.equal(true)
      api.cache.lockName = 'otherId'
      try {
        await api.cache.destroy(key, 'value')
        throw new Error('should not get here')
      } catch (error) {
        expect(String(error)).to.equal('Error: Object locked')
      }
    })

    it('you can opt to retry to obtain a lock if a lock is held (READ)', async () => {
      let success = await api.cache.save(key, 'value')
      expect(success).to.equal(true)
      let lockOk = await api.cache.lock(key, 1) // will be rounded up to 1s
      expect(lockOk).to.equal(true)

      api.cache.lockName = 'otherId'
      lockOk = await api.cache.checkLock(key, null)
      expect(lockOk).to.equal(false)

      let start = new Date().getTime()
      let {value} = await api.cache.load(key, {retry: 2000})
      expect(value).to.equal('value')
      let delta = new Date().getTime() - start
      expect(delta >= 1000).to.equal(true)
    })

    describe('locks are actually blocking', () => {
      let originalLockName

      before(() => { originalLockName = api.cache.lockName })
      after(() => { api.cache.lockName = originalLockName })

      it('locks are actually blocking', async () => {
        let key = 'test'
        let lockOk

        api.cache.lockName = `test-name-pass-${1}`
        lockOk = await api.cache.checkLock(key)
        expect(lockOk).to.equal(true)
        await api.cache.lock(key, (1000 * 60))

        api.cache.lockName = `test-name-pass-${2}`
        lockOk = await api.cache.checkLock(key)
        expect(lockOk).to.equal(false)

        api.cache.lockName = `test-name-pass-${3}`
        lockOk = await api.cache.checkLock(key)
        expect(lockOk).to.equal(false)
      })

      it('locks are actually blocking (using setnx value)', async () => {
        let key = 'test-setnx'
        let lockOk

        api.cache.lockName = `test-setnx-name-pass-${1}`
        lockOk = await api.cache.lock(key, (1000 * 60))
        expect(lockOk).to.equal(true)

        api.cache.lockName = `test-setnx-name-pass-${2}`
        lockOk = await api.cache.lock(key, (1000 * 60))
        expect(lockOk).to.equal(false)

        api.cache.lockName = `test-setnx-name-pass-${3}`
        lockOk = await api.cache.lock(key, (1000 * 60))
        expect(lockOk).to.equal(false)
      })
    })
  })

  describe('cache dump files', () => {
    let file = os.tmpdir() + path.sep + 'cacheDump'

    it('can read write the cache to a dump file', async () => {
      await api.cache.clear()
      await api.cache.save('thingA', 123)
      let count = await api.cache.dumpWrite(file)
      expect(count).to.equal(1)
      let body = JSON.parse(String(fs.readFileSync(file)))
      let content = JSON.parse(body['actionhero:cache:thingA'])
      expect(content.value).to.equal(123)
    })

    it('can load the cache from a dump file', async () => {
      await api.cache.clear()
      let count = await api.cache.dumpRead(file)
      expect(count).to.equal(1)
      let {value} = await api.cache.load('thingA')
      expect(value).to.equal(123)
    })
  })
})
