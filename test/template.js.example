'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('actionhero Tests', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('should have booted into the test env', () => {
    expect(process.env.NODE_ENV).to.equal('test')
    expect(api.env).to.equal('test')
    expect(api.id).to.be.ok()
  })

  it('can retrieve server uptime via the status action', async () => {
    let {uptime} = await api.specHelper.runAction('status')
    expect(uptime).to.be.above(0)
  })
})
