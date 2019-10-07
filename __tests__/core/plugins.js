'use strict'

const path = require('path')
const ChildProcess = require('child_process')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

let configChanges

async function exec (command, args) {
  return new Promise((resolve, reject) => {
    ChildProcess.exec(command, args, (error, stdout, stderr) => {
      if (error) { return reject(error) }
      return resolve({ stdout, stderr })
    })
  })
}

describe('Core: Plugins', () => {
  describe('with plugin', () => {
    beforeAll(async () => {
      configChanges = {
        plugins: {
          testPlugin: { path: path.join(__dirname, '..', 'testPlugin') }
        }
      }

      api = await actionhero.start({ configChanges })
    })

    afterAll(async () => { await actionhero.stop() })

    test('can load an action from a plugin', async () => {
      const response = await api.specHelper.runAction('pluginAction')
      expect(response.error).toBeUndefined()
      expect(response.cool).toEqual(true)
    })

    test('can load a task from a plugin', () => {
      expect(api.tasks.tasks.pluginTask).toBeTruthy()
      expect(api.tasks.jobs.pluginTask).toBeTruthy()
    })

    test('can load an initializer from a plugin', () => {
      expect(api.pluginInitializer.here).toEqual(true)
    })

    // test('can load a server from a plugin')

    test('can serve static files from a plugin', async () => {
      const file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.content).toEqual('<h1>PLUGIN!<h1>\n')
      expect(file.mime).toEqual('text/html')
    })

    test('can load CLI command from a plugin', async () => {
      const env = Object.assign({}, process.env)
      env.configChanges = JSON.stringify(configChanges)

      const { stdout: helpResponse, stderr: error1 } = await exec('./bin/actionhero help', { env })
      expect(error1).toEqual('')
      expect(helpResponse).toContain('hello')

      const { stdout: helloResponse, stderr: error2 } = await exec('./bin/actionhero hello', { env })
      expect(error2).toEqual('')
      expect(helloResponse).toContain('hello')
    })
  })

  describe('with plugin sections ignored', () => {
    beforeAll(async () => {
      configChanges = {
        plugins: {
          testPlugin: {
            path: path.join(__dirname, '..', 'testPlugin'),
            actions: false,
            tasks: false,
            servers: false,
            initializers: false,
            public: false,
            cli: false
          }
        }
      }

      api = await actionhero.start()
    })

    afterAll(async () => { await actionhero.stop() })

    test('will not load an action from an un-loaded plugin', async () => {
      const response = await api.specHelper.runAction('pluginAction')
      expect(response.error).toMatch(/unknown action or invalid apiVersion/)
    })

    test('will not load a task from an un-loaded plugin', () => {
      expect(api.tasks.tasks.pluginTask).not.toBeTruthy()
      expect(api.tasks.jobs.pluginTask).not.toBeTruthy()
    })

    test('will not load an initializer from an un-loaded plugin', () => {
      expect(api.pluginInitializer).not.toBeTruthy()
    })

    // test('will not load a server from an un-loaded plugin')

    test('will not serve static files from an un-loaded plugin', async () => {
      const file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.error).toMatch(/file is not found/)
    })

    test('will not load CLI command from an un-loaded plugin', async () => {
      const env = Object.assign({}, process.env)
      env.configChanges = JSON.stringify(configChanges)

      const { stdout: helpResponse, stderr: error1 } = await exec('./bin/actionhero help', { env })
      expect(error1).toEqual('')
      expect(helpResponse).not.toContain('hello')

      try {
        await exec('./bin/actionhero hello', { env })
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).toMatch(/`hello` is not a method I can perform/)
      }
    })
  })

  describe('without plugin', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    test('will not load an action from an un-loaded plugin', async () => {
      const response = await api.specHelper.runAction('pluginAction')
      expect(response.error).toMatch(/unknown action or invalid apiVersion/)
    })

    test('will not load a task from an un-loaded plugin', () => {
      expect(api.tasks.tasks.pluginTask).not.toBeTruthy()
      expect(api.tasks.jobs.pluginTask).not.toBeTruthy()
    })

    test('will not load an initializer from an un-loaded plugin', () => {
      expect(api.pluginInitializer).not.toBeTruthy()
    })

    // test('will not load a server from an un-loaded plugin')

    test('will not serve static files from an un-loaded plugin', async () => {
      const file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.error).toMatch(/file is not found/)
    })

    test('will not load CLI command from an un-loaded plugin', async () => {
      const { stdout: helpResponse, stderr: error1 } = await exec('./bin/actionhero help')
      expect(error1).toEqual('')
      expect(helpResponse).not.toContain('hello')

      try {
        await exec('./bin/actionhero hello')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).toMatch(/`hello` is not a method I can perform/)
      }
    })
  })
})
