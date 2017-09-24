'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: RandomNumber', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  let firstNumber = null
  it('generates random numbers', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
    firstNumber = randomNumber
  })

  it('is unique / random', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
    expect(randomNumber).not.to.equal(firstNumber)
  })
})
