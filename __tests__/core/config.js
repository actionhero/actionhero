'use strict'

const request = require('request-promise-native')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url
let configFolders

describe('Core: config folders', () => {
  beforeAll(async () => {
    configFolders = process.env.ACTIONHERO_CONFIG
    process.env.ACTIONHERO_CONFIG = [
      path.join(__dirname, '../../config'),
      path.join(__dirname, './config') // TODO: Generate and remove this on the fly.
    ].join(',')

    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  afterAll(async () => {
    await actionhero.stop()
    process.env.ACTIONHERO_CONFIG = configFolders
  })

  test('can call a route in the normal config/route.js', async () => {
    let {id, problems, name, error} = await request.get({uri: url + '/api/api-status', json: true})
    expect(error).toBeUndefined()
    expect(problems).toHaveLength(0)
    expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
    expect(name).toEqual('actionhero')
  })

  test('can call a different route in the new config/route.js (on same verb)', async () => {
    let {randomNumber} = await request.get({uri: url + '/api/random-number', json: true})
    expect(randomNumber).toBeGreaterThan(0)
    expect(randomNumber).toBeLessThan(1)
  })
})
