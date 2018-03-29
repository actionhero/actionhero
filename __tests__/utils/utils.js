'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Utils', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  describe('util.sleep', () => {
    test('it sleeps', async () => {
      const start = new Date().getTime()
      await api.utils.sleep(100)
      const end = new Date().getTime()
      expect(end - start).toBeGreaterThanOrEqual(100)
      expect(end - start).toBeLessThan(200)
    })
  })

  describe('utils.arrayUniqueify', () => {
    test('works', () => {
      let a = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5]
      expect(api.utils.arrayUniqueify(a)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('utils.asyncWaterfall', () => {
    test('works with no args', async () => {
      let sleepyFunc = async () => {
        await api.utils.sleep(100)
        return (new Date()).getTime()
      }

      let jobs = [sleepyFunc, sleepyFunc, sleepyFunc]

      let start = (new Date()).getTime()
      let results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).toBeGreaterThan(290)
      expect(results[1]).toBeGreaterThan(results[0])
      expect(results[2]).toBeGreaterThan(results[1])
    })

    test('works with args', async () => {
      let sleepyFunc = async (response) => {
        await api.utils.sleep(100)
        return response
      }

      let jobs = [
        {method: sleepyFunc, args: ['a']},
        {method: sleepyFunc, args: ['b']},
        {method: sleepyFunc, args: ['c']}
      ]

      let start = (new Date()).getTime()
      let results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).toBeGreaterThan(290)
      expect(results[0]).toEqual('a')
      expect(results[1]).toEqual('b')
      expect(results[2]).toEqual('c')
    })
  })

  describe('utils.collapseObjectToArray', () => {
    test('fails with numerical keys', () => {
      let o = {0: 'a', 1: 'b'}
      let response = api.utils.collapseObjectToArray(o)
      expect(response).toEqual(['a', 'b'])
    })

    test('fails with non-numerical keys', () => {
      let o = {a: 1}
      let response = api.utils.collapseObjectToArray(o)
      expect(response).toEqual(false)
    })
  })

  describe('utils.hashMerge', () => {
    let A = {a: 1, b: 2}
    let B = {b: -2, c: 3}
    let C = {a: 1, b: {m: 10, n: 11}}
    let D = {a: 1, b: {n: 111, o: 22}}

    test('simple', () => {
      let Z = api.utils.hashMerge(A, B)
      expect(Z.a).toEqual(1)
      expect(Z.b).toEqual(-2)
      expect(Z.c).toEqual(3)
    })

    test('directional', () => {
      let Z = api.utils.hashMerge(B, A)
      expect(Z.a).toEqual(1)
      expect(Z.b).toEqual(2)
      expect(Z.c).toEqual(3)
    })

    test('nested', () => {
      let Z = api.utils.hashMerge(C, D)
      expect(Z.a).toEqual(1)
      expect(Z.b.m).toEqual(10)
      expect(Z.b.n).toEqual(111)
      expect(Z.b.o).toEqual(22)
    })
  })

  describe('eventLoopDelay', () => {
    test('works', async () => {
      let eventLoopDelay = await api.utils.eventLoopDelay(10000)
      expect(eventLoopDelay).toBeGreaterThan(0)
      expect(eventLoopDelay).toBeLessThan(1)
    })
  })

  describe('#parseHeadersForClientAddress', () => {
    test('only x-real-ip, port is null', () => {
      let headers = {
        'x-real-ip': '10.11.12.13'
      }
      let { ip, port } = api.utils.parseHeadersForClientAddress(headers)
      expect(ip).toEqual('10.11.12.13')
      expect(port).toEqual(null)
    })
    test('load balancer, x-forwarded-for format', () => {
      let headers = {
        'x-forwarded-for': '35.36.37.38',
        'x-forwarded-port': '80'
      }
      let { ip, port } = api.utils.parseHeadersForClientAddress(headers)
      expect(ip).toEqual('35.36.37.38')
      expect(port).toEqual('80')
    })
  })

  describe('#parseIPv6URI', () => {
    test('address and port', () => {
      let uri = '[2604:4480::5]:8080'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(8080)
    })

    test('address without port', () => {
      let uri = '2604:4480::5'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(80)
    })

    test('full uri', () => {
      let uri = 'http://[2604:4480::5]:8080/foo/bar'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(8080)
    })

    test('failing address', () => {
      let uri = '[2604:4480:z:5]:80'
      try {
        let parts = api.utils.parseIPv6URI(uri)
        console.log(parts)
      } catch (e) {
        expect(e.message).toEqual('failed to parse address')
      }
    })

    test('should parse locally scoped ipv6 URIs without port', () => {
      let uri = 'fe80::1ff:fe23:4567:890a%eth2'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('fe80::1ff:fe23:4567:890a%eth2')
      expect(parts.port).toEqual(80)
    })

    test('should parse locally scoped ipv6 URIs with port', () => {
      let uri = '[fe80::1ff:fe23:4567:890a%eth2]:8080'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('fe80::1ff:fe23:4567:890a%eth2')
      expect(parts.port).toEqual(8080)
    })
  })

  describe('utils.filterObjectForLogging', () => {
    beforeEach(() => {
      expect(api.config.general.filteredParams.length).toEqual(0)
    })

    afterEach(() => {
      // after each test, empty the array
      api.config.general.filteredParams.length = 0
    })

    let testInput = {
      p1: 1,
      p2: 's3cr3t',
      o1: {
        o1p1: 1,
        o1p2: 'also-s3cr3t',
        o2: {
          o2p1: 'this is ok',
          o2p2: 'extremely-s3cr3t'
        }
      },
      o2: {
        name: 'same as o1`s inner object!',
        o2p1: 'nothing secret'
      }
    }

    test('can filter top level params, no matter the type', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'p2', 'o2')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).toEqual('[FILTERED]')
      expect(filteredParams.p2).toEqual('[FILTERED]')
      expect(filteredParams.o2).toEqual('[FILTERED]') // entire object filtered
      expect(filteredParams.o1).toEqual(testInput.o1) // unchanged
    })

    test('will not filter things that do not exist', () => {
      // Identity
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams).toEqual(testInput)

      api.config.general.filteredParams.push('p3', 'p4', 'o1.o3', 'o1.o2.p1')
      let filteredParams2 = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams2).toEqual(testInput)
    })

    test('can filter a single level dot notation', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'o1.o1p1', 'somethingNotExist')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).toEqual('[FILTERED]')
      expect(filteredParams.o1.o1p1).toEqual('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p2).toEqual(testInput.p2)
      expect(filteredParams.o1.o1p2).toEqual(testInput.o1.o1p2)
      expect(filteredParams.o1.o2).toEqual(testInput.o1.o2)
      expect(filteredParams.o2).toEqual(testInput.o2)
    })

    test('can filter two levels deep', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p2', 'o1.o2.o2p1', 'o1.o2.notThere')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p2).toEqual('[FILTERED]')
      expect(filteredParams.o1.o2.o2p1).toEqual('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p1).toEqual(testInput.p1)
      expect(filteredParams.o1.o1p1).toEqual(testInput.o1.o1p1)
      expect(filteredParams.o1.o2.o2p2).toEqual(testInput.o1.o2.o2p2)
    })
  })
})
