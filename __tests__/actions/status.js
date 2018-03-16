'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: status', () => {
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  test('returns node status', async () => {
    let {id, problems, name, error} = await api.specHelper.runAction('status')
    expect(error).toBeUndefined()
    expect(problems).toHaveLength(0)
    expect(id).toEqual('test-server-' + process.pid)
    expect(name).toEqual('actionhero')
  })
})
