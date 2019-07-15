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
      expect(end - start).toBeGreaterThanOrEqual(99)
      expect(end - start).toBeLessThan(200)
    })
  })

  describe('utils.arrayUniqueify', () => {
    test('works', () => {
      const a = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5]
      expect(api.utils.arrayUniqueify(a)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('utils.asyncWaterfall', () => {
    test('works with no args', async () => {
      const sleepyFunc = async () => {
        await api.utils.sleep(100)
        return (new Date()).getTime()
      }

      const jobs = [sleepyFunc, sleepyFunc, sleepyFunc]

      const start = (new Date()).getTime()
      const results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).toBeGreaterThan(290)
      expect(results[1]).toBeGreaterThan(results[0])
      expect(results[2]).toBeGreaterThan(results[1])
    })

    test('works with args', async () => {
      const sleepyFunc = async (response) => {
        await api.utils.sleep(100)
        return response
      }

      const jobs = [
        { method: sleepyFunc, args: ['a'] },
        { method: sleepyFunc, args: ['b'] },
        { method: sleepyFunc, args: ['c'] }
      ]

      const start = (new Date()).getTime()
      const results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).toBeGreaterThan(290)
      expect(results[0]).toEqual('a')
      expect(results[1]).toEqual('b')
      expect(results[2]).toEqual('c')
    })
  })

  describe('utils.collapseObjectToArray', () => {
    test('fails with numerical keys', () => {
      const o = { 0: 'a', 1: 'b' }
      const response = api.utils.collapseObjectToArray(o)
      expect(response).toEqual(['a', 'b'])
    })

    test('fails with non-numerical keys', () => {
      const o = { a: 1 }
      const response = api.utils.collapseObjectToArray(o)
      expect(response).toEqual(false)
    })
  })

  describe('utils.hashMerge', () => {
    const A = { a: 1, b: 2 }
    const B = { b: -2, c: 3 }
    const C = { a: 1, b: { m: 10, n: 11 } }
    const D = { a: 1, b: { n: 111, o: 22, p: {} } }
    const E = { b: {} }
    const N = { b: null }
    const U = { b: undefined }

    test('simple', () => {
      const Z = api.utils.hashMerge(A, B)
      expect(Z.a).toEqual(1)
      expect(Z.b).toEqual(-2)
      expect(Z.c).toEqual(3)
    })

    test('directional', () => {
      const Z = api.utils.hashMerge(B, A)
      expect(Z.a).toEqual(1)
      expect(Z.b).toEqual(2)
      expect(Z.c).toEqual(3)
    })

    test('nested', () => {
      const Z = api.utils.hashMerge(C, D)
      expect(Z.a).toEqual(1)
      expect(Z.b.m).toEqual(10)
      expect(Z.b.n).toEqual(111)
      expect(Z.b.o).toEqual(22)
      expect(Z.b.p).toEqual({})
    })

    test('empty01', () => {
      const Z = api.utils.hashMerge(E, D)
      expect(Z.a).toEqual(1)
      expect(Z.b.n).toEqual(111)
      expect(Z.b.o).toEqual(22)
      expect(Z.b.p).toEqual({})
    })

    test('empty10', () => {
      const Z = api.utils.hashMerge(D, E)
      expect(Z.a).toEqual(1)
      expect(Z.b.n).toEqual(111)
      expect(Z.b.o).toEqual(22)
      expect(Z.b.p).toEqual({})
    })

    test('chained', () => {
      const Z = api.utils.hashMerge(api.utils.hashMerge(C, E), D)
      expect(Z.a).toEqual(1)
      expect(Z.b.m).toEqual(10)
      expect(Z.b.n).toEqual(111)
      expect(Z.b.o).toEqual(22)
      expect(Z.b.p).toEqual({})
    })

    test('null', () => {
      const Z = api.utils.hashMerge(A, N)
      expect(Z.a).toEqual(1)
      expect(Z.b).toBeUndefined()
    })

    test('undefined', () => {
      const Z = api.utils.hashMerge(A, U)
      expect(Z.a).toEqual(1)
      expect(Z.b).toEqual(2)
    })
  })

  describe('eventLoopDelay', () => {
    test('works', async () => {
      const eventLoopDelay = await api.utils.eventLoopDelay(10000)
      expect(eventLoopDelay).toBeGreaterThan(0)
      expect(eventLoopDelay).toBeLessThan(1)
    })
  })

  describe('#parseHeadersForClientAddress', () => {
    test('only x-real-ip, port is null', () => {
      const headers = {
        'x-real-ip': '10.11.12.13'
      }
      const { ip, port } = api.utils.parseHeadersForClientAddress(headers)
      expect(ip).toEqual('10.11.12.13')
      expect(port).toEqual(null)
    })
    test('load balancer, x-forwarded-for format', () => {
      const headers = {
        'x-forwarded-for': '35.36.37.38',
        'x-forwarded-port': '80'
      }
      const { ip, port } = api.utils.parseHeadersForClientAddress(headers)
      expect(ip).toEqual('35.36.37.38')
      expect(port).toEqual('80')
    })
  })

  describe('#parseIPv6URI', () => {
    test('address and port', () => {
      const uri = '[2604:4480::5]:8080'
      const parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(8080)
    })

    test('address without port', () => {
      const uri = '2604:4480::5'
      const parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(80)
    })

    test('full uri', () => {
      const uri = 'http://[2604:4480::5]:8080/foo/bar'
      const parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('2604:4480::5')
      expect(parts.port).toEqual(8080)
    })

    test('failing address', () => {
      const uri = '[2604:4480:z:5]:80'
      try {
        const parts = api.utils.parseIPv6URI(uri)
        console.log(parts)
      } catch (e) {
        expect(e.message).toEqual('failed to parse address')
      }
    })

    test('should parse locally scoped ipv6 URIs without port', () => {
      const uri = 'fe80::1ff:fe23:4567:890a%eth2'
      const parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('fe80::1ff:fe23:4567:890a%eth2')
      expect(parts.port).toEqual(80)
    })

    test('should parse locally scoped ipv6 URIs with port', () => {
      const uri = '[fe80::1ff:fe23:4567:890a%eth2]:8080'
      const parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).toEqual('fe80::1ff:fe23:4567:890a%eth2')
      expect(parts.port).toEqual(8080)
    })
  })

  describe('utils.arrayStartingMatch', () => {
    test('finds matching arrays', () => {
      const a = [1, 2, 3]
      const b = [1, 2, 3, 4, 5]
      const numberResult = api.utils.arrayStartingMatch(a, b)
      expect(numberResult).toBe(true)

      const c = ['a', 'b', 'c']
      const d = ['a', 'b', 'c', 'd', 'e']
      const stringResult = api.utils.arrayStartingMatch(c, d)
      expect(stringResult).toBe(true)
    })

    test('finds non-matching arrays', () => {
      const a = [1, 3]
      const b = [1, 2, 3, 4, 5]
      const numberResult = api.utils.arrayStartingMatch(a, b)
      expect(numberResult).toBe(false)

      const c = ['a', 'b', 'c']
      const d = ['a', 'b', 'd', 'e']
      const stringResult = api.utils.arrayStartingMatch(c, d)
      expect(stringResult).toBe(false)
    })

    test('does not pass with empty arrays; first', () => {
      const a = []
      const b = [1, 2, 3, 4, 5]
      const result = api.utils.arrayStartingMatch(a, b)
      expect(result).toBe(false)
    })

    test('does not pass with empty arrays; second', () => {
      const a = [1, 2, 3, 4, 5]
      const b = []
      const result = api.utils.arrayStartingMatch(a, b)
      expect(result).toBe(false)
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

    const testInput = {
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
      const inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'p2', 'o2')
      const filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).toEqual('[FILTERED]')
      expect(filteredParams.p2).toEqual('[FILTERED]')
      expect(filteredParams.o2).toEqual('[FILTERED]') // entire object filtered
      expect(filteredParams.o1).toEqual(testInput.o1) // unchanged
    })

    test('will not filter things that do not exist', () => {
      // Identity
      const inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      const filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams).toEqual(testInput)

      api.config.general.filteredParams.push('p3', 'p4', 'o1.o3', 'o1.o2.p1')
      const filteredParams2 = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams2).toEqual(testInput)
    })

    test('can filter a single level dot notation', () => {
      const inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'o1.o1p1', 'somethingNotExist')
      const filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).toEqual('[FILTERED]')
      expect(filteredParams.o1.o1p1).toEqual('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p2).toEqual(testInput.p2)
      expect(filteredParams.o1.o1p2).toEqual(testInput.o1.o1p2)
      expect(filteredParams.o1.o2).toEqual(testInput.o1.o2)
      expect(filteredParams.o2).toEqual(testInput.o2)
    })

    test('can filter two levels deep', () => {
      const inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p2', 'o1.o2.o2p1', 'o1.o2.notThere')
      const filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p2).toEqual('[FILTERED]')
      expect(filteredParams.o1.o2.o2p1).toEqual('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p1).toEqual(testInput.p1)
      expect(filteredParams.o1.o1p1).toEqual(testInput.o1.o1p1)
      expect(filteredParams.o1.o2.o2p2).toEqual(testInput.o1.o2.o2p2)
    })
  })
})
