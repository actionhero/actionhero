'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Utils', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('utils.arrayUniqueify', (done) => {
    var a = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5]
    expect(api.utils.arrayUniqueify(a)).to.deep.equal([1, 2, 3, 4, 5])
    done()
  })

  describe('utils.hashMerge', () => {
    var A = {a: 1, b: 2}
    var B = {b: -2, c: 3}
    var C = {a: 1, b: {m: 10, n: 11}}
    var D = {a: 1, b: {n: 111, o: 22}}

    it('simple', (done) => {
      var Z = api.utils.hashMerge(A, B)
      expect(Z.a).to.equal(1)
      expect(Z.b).to.equal(-2)
      expect(Z.c).to.equal(3)
      done()
    })

    it('directional', (done) => {
      var Z = api.utils.hashMerge(B, A)
      expect(Z.a).to.equal(1)
      expect(Z.b).to.equal(2)
      expect(Z.c).to.equal(3)
      done()
    })

    it('nested', (done) => {
      var Z = api.utils.hashMerge(C, D)
      expect(Z.a).to.equal(1)
      expect(Z.b.m).to.equal(10)
      expect(Z.b.n).to.equal(111)
      expect(Z.b.o).to.equal(22)
      done()
    })
  })

  it('utils.objClone', (done) => {
    var a = {
      a: 1,
      b: 2,
      c: {
        first: 1,
        second: 2
      }
    }
    var b = api.utils.objClone(a)
    expect(a).to.deep.equal(b)
    delete a.a
    expect(a).not.to.equal(b)
    done()
  })

  describe('#parseIPv6URI', () => {
    it('address and port', () => {
      var uri = '[2604:4480::5]:8080'
      var parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(8080)
    })

    it('address without port', () => {
      var uri = '2604:4480::5'
      var parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(80)
    })

    it('full uri', () => {
      var uri = 'http://[2604:4480::5]:8080/foo/bar'
      var parts = api.utils.parseIPv6URI(uri)
      expect(parts.host).to.equal('2604:4480::5')
      expect(parts.port).to.equal(8080)
    })

    it('failing address', () => {
      var uri = '[2604:4480:z:5]:80'
      try {
        var parts = api.utils.parseIPv6URI(uri)
        console.log(parts)
      } catch (e) {
        expect(e.message).to.equal('failed to parse address')
      }
    })
  })
  describe('utils.filterObjectForLogging', function () {
    beforeEach(function () {
      expect(api.config.general.filteredParams.length).to.equal(0)
    })
    afterEach(function () {
      // after each test, empty the array
      api.config.general.filteredParams.length = 0
    })
    var testInput = {
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

    it('can filter top level params, no matter the type', function () {
      var inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'p2', 'o2')
      var filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).to.equal('[FILTERED]')
      expect(filteredParams.p2).to.equal('[FILTERED]')
      expect(filteredParams.o2).to.equal('[FILTERED]') // entire object filtered
      expect(filteredParams.o1).to.deep.equal(testInput.o1) // unchanged
    })

    it('will not filter things that do not exist', function () {
      // Identity
      var inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      var filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams).to.deep.equal(testInput)

      api.config.general.filteredParams.push('p3', 'p4', 'o1.o3', 'o1.o2.p1')
      var filteredParams2 = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams2).to.deep.equal(testInput)
    })

    it('can filter a single level dot notation', function () {
      var inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p1', 'o1.o1p1', 'somethingNotExist')
      var filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p1).to.equal('[FILTERED]')
      expect(filteredParams.o1.o1p1).to.equal('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p2).to.equal(testInput.p2)
      expect(filteredParams.o1.o1p2).to.equal(testInput.o1.o1p2)
      expect(filteredParams.o1.o2).to.deep.equal(testInput.o1.o2)
      expect(filteredParams.o2).to.deep.equal(testInput.o2)
    })

    it('can filter two levels deep', function () {
      var inputs = JSON.parse(JSON.stringify(testInput)) // quick deep Clone
      api.config.general.filteredParams.push('p2', 'o1.o2.o2p1', 'o1.o2.notThere')
      var filteredParams = api.utils.filterObjectForLogging(inputs)
      expect(filteredParams.p2).to.equal('[FILTERED]')
      expect(filteredParams.o1.o2.o2p1).to.equal('[FILTERED]')
      // Unchanged things
      expect(filteredParams.p1).to.equal(testInput.p1)
      expect(filteredParams.o1.o1p1).to.equal(testInput.o1.o1p1)
      expect(filteredParams.o1.o2.o2p2).to.equal(testInput.o1.o2.o2p2)
    })
  })
})
