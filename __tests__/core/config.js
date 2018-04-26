'use strict'

const { promisify } = require('util')
const fs = require('fs')
const path = require('path')

const request = require('request-promise-native')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url
let configFolders
const newConfigFolderPath = path.join(__dirname, 'config')
const newRoutesFilePath = path.join(newConfigFolderPath, 'routes.js')
const routeFileContent = `exports['default'] = {\n  routes: (api) => {\n    return {\n\n      get: [\n        { path: 'random-number', action: 'randomNumber' }\n      ]\n\n    }\n  }\n}\n`

const createRouteFile = async () => {
  try {
    await promisify(fs.mkdir)(newConfigFolderPath)
  } catch (ex) {}

  try {
    await promisify(fs.writeFile)(newRoutesFilePath, routeFileContent, { encoding: 'utf-8' })
  } catch (ex) {}
}

const removeRouteFile = async () => {
  try {
    await promisify(fs.unlink)(newRoutesFilePath)
  } catch (ex) {}

  try {
    await promisify(fs.rmdir)(newConfigFolderPath)
  } catch (ex) {}
}

describe('Core: config folders', () => {
  beforeAll(async () => {
    configFolders = process.env.ACTIONHERO_CONFIG

    await removeRouteFile()
    await createRouteFile()

    process.env.ACTIONHERO_CONFIG = [
      path.join(__dirname, '../../config'),
      newConfigFolderPath
    ].join(',')

    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  afterAll(async () => {
    await actionhero.stop()
    await removeRouteFile()
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
