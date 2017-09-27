'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Test: RunAction', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('can run the task manually', async () => {
    const {randomNumber} = await api.specHelper.runTask('runAction', {action: 'randomNumber'})
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
  })
})
