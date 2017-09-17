'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: Sleep', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('will return data from an async action', async () => {
    let {sleepDuration} = await api.specHelper.runAction('sleepTest')
    expect(sleepDuration).to.equal(1000)
  })

  it('can change sleepDuration', async () => {
    let {sleepDuration} = await api.specHelper.runAction('sleepTest', {sleepDuration: 100})
    expect(sleepDuration).to.equal(100)
  })
})
