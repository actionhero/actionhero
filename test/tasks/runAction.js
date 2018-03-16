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
  beforeAll(async () => { api = await actionhero.start() })
  afterAll(async () => { await actionhero.stop() })

  test('can run the task manually', async () => {
    const {randomNumber} = await api.specHelper.runTask('runAction', {action: 'randomNumber'})
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
  })
})
