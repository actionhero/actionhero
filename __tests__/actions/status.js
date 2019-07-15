'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('status', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('returns node status', async () => {
      const { id, problems, name, error } = await api.specHelper.runAction('status')
      expect(error).toBeUndefined()
      expect(problems).toHaveLength(0)
      expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
      expect(name).toEqual('actionhero')
    })
  })
})
