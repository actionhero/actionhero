'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

describe('Action: Show Documentation', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('returns the correct parts', async () => {
    let {documentation, serverInformation} = await api.specHelper.runAction('showDocumentation')
    expect(Object.keys(documentation).length).to.equal(6) // 6 actions
    expect(serverInformation.serverName).to.equal('actionhero')
  })
})
