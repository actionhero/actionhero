'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: Show Documentation', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('returns the correct parts', async () => {
    let {documentation, serverInformation} = await api.specHelper.runAction('showDocumentation')
    expect(Object.keys(documentation).length).to.equal(7) // 7 actions
    expect(serverInformation.serverName).to.equal('actionhero')
  })
})
