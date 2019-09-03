'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('Cache', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('fails with no params', async () => {
      const { error } = await api.specHelper.runAction('cacheTest', {})
      expect(error).toEqual('Error: key is a required parameter for this action')
    })

    test('fails with just key', async () => {
      const { error } = await api.specHelper.runAction('cacheTest', { key: 'test key' })
      expect(error).toEqual('Error: value is a required parameter for this action')
    })

    test('fails with just value', async () => {
      const { error } = await api.specHelper.runAction('cacheTest', { value: 'abc123' })
      expect(error).toEqual('Error: key is a required parameter for this action')
    })

    test('fails with gibberish param', async () => {
      const { error } = await api.specHelper.runAction('cacheTest', { thingy: 'abc123' })
      expect(error).toEqual('Error: key is a required parameter for this action')
    })

    test('fails with value shorter than 2 letters', async () => {
      const { error } = await api.specHelper.runAction('cacheTest', { key: 'abc123', value: 'v' })
      expect(error).toEqual('Error: inputs should be at least 3 letters long')
    })

    test('works with correct params', async () => {
      const { cacheTestResults } = await api.specHelper.runAction('cacheTest', { key: 'testKey', value: 'abc123' })
      expect(cacheTestResults.saveResp).toEqual(true)
      expect(cacheTestResults.loadResp.value).toEqual('abc123')
      expect(cacheTestResults.deleteResp).toEqual(true)
    })
  })
})
