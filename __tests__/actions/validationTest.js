'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('validationTest', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('fails with no params', async () => {
      const { error } = await api.specHelper.runAction('validationTest', {})
      expect(error).toEqual('Error: string is a required parameter for this action')
    })

    test('fails with a number', async () => {
      const { error } = await api.specHelper.runAction('validationTest', { string: 87 })
      expect(error).toEqual('Error: Input for parameter "string" failed validation!')
    })
  })
})
