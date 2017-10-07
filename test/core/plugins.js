'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const {promisify} = require('util')
const exec = require('child_process').exec
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

let configChanges

describe('Core: Plugins', () => {
  describe('with plugin', () => {
    before(async () => {
      configChanges = {
        plugins: {
          'testPlugin': { path: path.join(__dirname, '..', 'testPlugin') }
        }
      }

      api = await actionhero.start({configChanges})
    })

    after(async () => { await actionhero.stop() })

    it('can load an action from a plugin', async () => {
      let response = await api.specHelper.runAction('pluginAction')
      expect(response.error).to.not.exist()
      expect(response.cool).to.equal(true)
    })

    it('can load a task from a plugin', () => {
      expect(api.tasks.tasks.pluginTask).to.exist()
      expect(api.tasks.jobs.pluginTask).to.exist()
    })

    it('can load an initializer from a plugin', () => {
      expect(api.pluginInitializer.here).to.equal(true)
    })

    it('can load a server from a plugin')

    it('can serve static files from a plugin', async () => {
      let file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.content).to.equal('<h1>PLUGIN!<h1>\n')
      expect(file.mime).to.equal('text/html')
    })

    it('can load CLI command from a plugin', async () => {
      let env = Object.assign({}, process.env)
      env.configChanges = JSON.stringify(configChanges)

      let {stdout: helpResponse, stderr: error1} = await promisify(exec)('./bin/actionhero help', {env})
      expect(error1).to.equal('')
      expect(helpResponse).to.contain('hello')

      let {stdout: helloResponse, stderr: error2} = await promisify(exec)('./bin/actionhero hello', {env})
      expect(error2).to.equal('')
      expect(helloResponse).to.contain('hello')
    })
  })

  describe('with plugin sections ignored', () => {
    before(async () => {
      configChanges = {
        plugins: {
          'testPlugin': {
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

    after(async () => { await actionhero.stop() })

    it('will not load an action from an un-loaded plugin', async () => {
      let response = await api.specHelper.runAction('pluginAction')
      expect(response.error).to.match(/unknown action or invalid apiVersion/)
    })

    it('will not load a task from an un-loaded plugin', () => {
      expect(api.tasks.tasks.pluginTask).not.to.exist()
      expect(api.tasks.jobs.pluginTask).not.to.exist()
    })

    it('will not load an initializer from an un-loaded plugin', () => {
      expect(api.pluginInitializer).not.to.exist()
    })

    it('will not load a server from an un-loaded plugin')

    it('will not serve static files from an un-loaded plugin', async () => {
      let file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.error).to.match(/file is not found/)
    })

    it('will not load CLI command from an un-loaded plugin', async () => {
      let env = Object.assign({}, process.env)
      env.configChanges = JSON.stringify(configChanges)

      let {stdout: helpResponse, stderr: error1} = await promisify(exec)('./bin/actionhero help', {env})
      expect(error1).to.equal('')
      expect(helpResponse).to.not.contain('hello')

      try {
        await promisify(exec)('./bin/actionhero hello', {env})
        throw new Error('should not get here')
      } catch (error) {
        expect(error).to.match(/`hello` is not a method I can perform/)
      }
    })
  })

  describe('without plugin', () => {
    before(async () => { api = await actionhero.start() })
    after(async () => { await actionhero.stop() })

    it('will not load an action from an un-loaded plugin', async () => {
      let response = await api.specHelper.runAction('pluginAction')
      expect(response.error).to.match(/unknown action or invalid apiVersion/)
    })

    it('will not load a task from an un-loaded plugin', () => {
      expect(api.tasks.tasks.pluginTask).not.to.exist()
      expect(api.tasks.jobs.pluginTask).not.to.exist()
    })

    it('will not load an initializer from an un-loaded plugin', () => {
      expect(api.pluginInitializer).not.to.exist()
    })

    it('will not load a server from an un-loaded plugin')

    it('will not serve static files from an un-loaded plugin', async () => {
      let file = await api.specHelper.getStaticFile('plugin.html')
      expect(file.error).to.match(/file is not found/)
    })

    it('will not load CLI command from an un-loaded plugin', async () => {
      let {stdout: helpResponse, stderr: error1} = await promisify(exec)('./bin/actionhero help')
      expect(error1).to.equal('')
      expect(helpResponse).to.not.contain('hello')

      try {
        await promisify(exec)('./bin/actionhero hello')
        throw new Error('should not get here')
      } catch (error) {
        expect(error).to.match(/`hello` is not a method I can perform/)
      }
    })
  })
})
