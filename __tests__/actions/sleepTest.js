'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: Sleep', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  test('will return data from an async action', async () => {
    let {sleepDuration} = await api.specHelper.runAction('sleepTest')
    expect(sleepDuration).toEqual(1000)
  })

  test('can change sleepDuration', async () => {
    let {sleepDuration} = await api.specHelper.runAction('sleepTest', {sleepDuration: 100})
    expect(sleepDuration).toEqual(100)
  })
})
