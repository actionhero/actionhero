'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Test: RunAction', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  test('can run the task manually', async () => {
    const { randomNumber } = await api.specHelper.runTask('runAction', { action: 'randomNumber' })
    expect(randomNumber).toBeGreaterThanOrEqual(0)
    expect(randomNumber).toBeLessThan(1)
  })
})
