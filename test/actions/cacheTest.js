'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: Cache', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('fails with no params', async () => {
    let {error} = await api.specHelper.runAction('cacheTest', {})
    expect(error).to.equal('Error: key is a required parameter for this action')
  })

  it('fails with just key', async () => {
    let {error} = await api.specHelper.runAction('cacheTest', {key: 'test key'})
    expect(error).to.equal('Error: value is a required parameter for this action')
  })

  it('fails with just value', async () => {
    let {error} = await api.specHelper.runAction('cacheTest', {value: 'abc123'})
    expect(error).to.equal('Error: key is a required parameter for this action')
  })

  it('fails with gibberish param', async () => {
    let {error} = await api.specHelper.runAction('cacheTest', {thingy: 'abc123'})
    expect(error).to.equal('Error: key is a required parameter for this action')
  })

  it('fails with value shorter than 2 letters', async () => {
    let {error} = await api.specHelper.runAction('cacheTest', {key: 'abc123', value: 'v'})
    expect(error).to.equal('Error: inputs should be at least 3 letters long')
  })

  it('works with correct params', async () => {
    let {cacheTestResults} = await api.specHelper.runAction('cacheTest', {key: 'testKey', value: 'abc123'})
    expect(cacheTestResults.saveResp).to.equal(true)
    expect(cacheTestResults.loadResp.value).to.equal('abc123')
    expect(cacheTestResults.deleteResp).to.equal(true)
  })
})
