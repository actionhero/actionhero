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
const newConfigFolderPaths = [
  path.join(__dirname, 'first_config'),
  path.join(__dirname, 'second_config')
]
const routeFilesContent = [
  'exports[\'default\'] = {\n  routes: (api) => {\n    return {\n\n      get: [\n        { path: \'/api-status\', action: \'status\' }\n      ]\n\n    }\n  }\n}\n',
  'exports[\'default\'] = {\n  routes: (api) => {\n    return {\n\n      get: [\n        { path: \'/random-number\', action: \'randomNumber\' }\n      ]\n\n    }\n  }\n}\n'
]

const createRouteFile = async (newConfigFolderPath, routeFileContent) => {
  try {
    await promisify(fs.mkdir)(newConfigFolderPath)
  } catch (ex) {}

  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, 'routes.js')

    await promisify(fs.writeFile)(newRoutesFilePath, routeFileContent, { encoding: 'utf-8' })
  } catch (ex) {}
}

const removeRouteFile = async (newConfigFolderPath) => {
  try {
    const newRoutesFilePath = path.join(newConfigFolderPath, 'routes.js')

    await promisify(fs.unlink)(newRoutesFilePath)
  } catch (ex) {}

  try {
    await promisify(fs.rmdir)(newConfigFolderPath)
  } catch (ex) {}
}

describe('Core: config folders', () => {
  beforeAll(async () => {
    configFolders = process.env.ACTIONHERO_CONFIG

    await createRouteFile(newConfigFolderPaths[0], routeFilesContent[0])
    await createRouteFile(newConfigFolderPaths[1], routeFilesContent[1])

    process.env.ACTIONHERO_CONFIG = newConfigFolderPaths.join(',')

    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  afterAll(async () => {
    await actionhero.stop()
    await removeRouteFile(newConfigFolderPaths[0])
    await removeRouteFile(newConfigFolderPaths[1])
    process.env.ACTIONHERO_CONFIG = configFolders
  })

  test('can call a route in the normal config/route.js', async () => {
    const { id, problems, name, error } = await request.get({ uri: url + '/api/api-status', json: true })
    expect(error).toBeUndefined()
    expect(problems).toHaveLength(0)
    expect(id).toEqual(`test-server-${process.env.JEST_WORKER_ID || 0}`)
    expect(name).toEqual('actionhero')
  })

  test('can call a different route in the new config/route.js (on same verb)', async () => {
    const { randomNumber } = await request.get({ uri: url + '/api/random-number', json: true })
    expect(randomNumber).toBeGreaterThan(0)
    expect(randomNumber).toBeLessThan(1)
  })
})
