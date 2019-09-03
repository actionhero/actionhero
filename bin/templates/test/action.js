'use strict'

const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('%%name%%', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('returns OK', async () => {
      const { ok } = await api.specHelper.runAction('%%name%%')
      expect(ok).toEqual(true)
    })
  })
})
