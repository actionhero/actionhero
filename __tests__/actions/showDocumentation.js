'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('showDocumentation', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('returns the correct parts', async () => {
      const { documentation, serverInformation } = await api.specHelper.runAction('showDocumentation')
      expect(Object.keys(documentation).length).toEqual(7) // 7 actions
      expect(serverInformation.serverName).toEqual('actionhero')
    })
  })
})
