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

describe('Utils', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  describe('utils.arrayUniqueify', () => {
    it('works', () => {
      let a = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5]
      expect(api.utils.arrayUniqueify(a)).to.deep.equal([1, 2, 3, 4, 5])
    })
  })

  describe('utils.asyncWaterfall', () => {
    it('works with no args', async () => {
      let sleepyFunc = async () => {
        await sleep(100)
        return (new Date()).getTime()
      }

      let jobs = [sleepyFunc, sleepyFunc, sleepyFunc]

      let start = (new Date()).getTime()
      let results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).to.be.above(290)
      expect(results[1]).to.be.above(results[0])
      expect(results[2]).to.be.above(results[1])
    })

    it('works with args', async () => {
      let sleepyFunc = async (response) => {
        await sleep(100)
        return response
      }

      let jobs = [
        {method: sleepyFunc, args: ['a']},
        {method: sleepyFunc, args: ['b']},
        {method: sleepyFunc, args: ['c']}
      ]

      let start = (new Date()).getTime()
      let results = await api.utils.asyncWaterfall(jobs)
      expect((new Date()).getTime() - start).to.be.above(290)
      expect(results[0]).to.equal('a')
      expect(results[1]).to.equal('b')
      expect(results[2]).to.equal('c')
    })
  })

  describe('utils.collapseObjectToArray', () => {
    it('fails with numerical keys', () => {
      let o = {0: 'a', 1: 'b'}
      let response = api.utils.collapseObjectToArray(o)
      expect(response).to.deep.equal(['a', 'b'])
    })

    it('fails with non-numerical keys', () => {
      let o = {a: 1}
      let response = api.utils.collapseObjectToArray(o)
      expect(response).to.equal(false)
    })
  })

  describe('utils.hashMerge', () => {
    let A = {a: 1, b: 2}
    let B = {b: -2, c: 3}
    let C = {a: 1, b: {m: 10, n: 11}}
    let D = {a: 1, b: {n: 111, o: 22}}

    it('simple', () => {
      let Z = api.utils.hashMerge(A, B)
      expect(Z.a).to.equal(1)
      expect(Z.b).to.equal(-2)
      expect(Z.c).to.equal(3)
    })

    it('directional', () => {
      let Z = api.utils.hashMerge(B, A)
      expect(Z.a).to.equal(1)
      expect(Z.b).to.equal(2)
      expect(Z.c).to.equal(3)
    })

    it('nested', () => {
      let Z = api.utils.hashMerge(C, D)
      expect(Z.a).to.equal(1)
      expect(Z.b.m).to.equal(10)
      expect(Z.b.n).to.equal(111)
      expect(Z.b.o).to.equal(22)
    })
  })

  describe('eventLoopDelay', () => {
    it('works', async () => {
      let eventLoopDelay = await api.utils.eventLoopDelay(10000)
      expect(eventLoopDelay).to.be.above(0)
      expect(eventLoopDelay).to.be.below(1)
    })
  })

  describe('#parseIPv6URI', () => {
    it('address and port', () => {
      let uri = '[2604:4480::5]:8080'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(8080)
    })

    it('address without port', () => {
      let uri = '2604:4480::5'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(80)
    })

    it('full uri', () => {
      let uri = 'http://[2604:4480::5]:8080/foo/bar'
      let parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(8080)
    })

    it('failing address', () => {
      let uri = '[2604:4480:z:5]:80'
      try {
        let parts = api.utils.parseIPv6URI(uri)
        console.log(parts)
      } catch (e) {
        expect(e.message).to.equal('failed to parse address')
      }
    })
  })

  describe('utils.filterObjectForLogging', () => {
    beforeEach(() => {
      expect(api.config.general.filteredParams.length).to.equal(0)
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

    it('can filter top level params, no matter the type', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'p2', 'o2')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).to.equal('[FILTERED]')
      expect(filteredParams.p2).to.equal('[FILTERED]')
      expect(filteredParams.o2).to.equal('[FILTERED]') // entire object filtered
      expect(filteredParams.o1).to.deep.equal(testInput.o1) // unchanged
    })

    it('will not filter things that do not exist', () => {
      // Identity
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams).to.deep.equal(testInput)

      api.config.general.filteredParams.push('p3', 'p4', 'o1.o3', 'o1.o2.p1')
      let filteredParams2 = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams2).to.deep.equal(testInput)
    })

    it('can filter a single level dot notation', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'o1.o1p1', 'somethingNotExist')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).to.equal('[FILTERED]')
      expect(filteredParams.o1.o1p1).to.equal('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p2).to.equal(testInput.p2)
      expect(filteredParams.o1.o1p2).to.equal(testInput.o1.o1p2)
      expect(filteredParams.o1.o2).to.deep.equal(testInput.o1.o2)
      expect(filteredParams.o2).to.deep.equal(testInput.o2)
    })

    it('can filter two levels deep', () => {
      let inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p2', 'o1.o2.o2p1', 'o1.o2.notThere')
      let filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p2).to.equal('[FILTERED]')
      expect(filteredParams.o1.o2.o2p1).to.equal('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p1).to.equal(testInput.p1)
      expect(filteredParams.o1.o1p1).to.equal(testInput.o1.o1p1)
      expect(filteredParams.o1.o2.o2p2).to.equal(testInput.o1.o2.o2p2)
    })
  })
})
