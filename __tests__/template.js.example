'use strict'

const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('actionhero Tests', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  test('should have booted into the test env', () => {
    expect(process.env.NODE_ENV).toEqual('test')
    expect(api.env).toEqual('test')
    expect(api.id).toBeTruthy()
  })

  test('can retrieve server uptime via the status action', async () => {
    let { uptime } = await api.specHelper.runAction('status')
    expect(uptime).toBeGreaterThan(0)
  })
})
