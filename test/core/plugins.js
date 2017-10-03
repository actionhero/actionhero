'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

const configChanges = {
  plugins: {
    'testPlugin': { path: path.join(__dirname, '..', '..', 'testPlugin') }
  }
}

describe('Core: Plugins', () => {
  describe('with plugin', () => {
    before(async () => { api = await actionhero.start({configChanges}) })
    after(async () => { await actionhero.stop() })

    it('can load an action from a plugin', async () => {
      let response = await api.specHelper.runAction('pluginAction')
      expect(response.error).to.not.exist()
      expect(response.cool).to.equal(true)
    })

    it('can load a task from a plugin')
    it('can load an initializer from a plugin')
    it('can load a server from a plugin')
    it('can serve static files from a plugin')
  })

  describe('without plugin partially loaded', () => {})
  describe('without plugin', () => {})
})
