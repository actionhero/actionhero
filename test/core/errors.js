'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()

let api
let originalUnknownAction

describe('Core: Errors', () => {
  before(async () => {
    api = await actionhero.start()
    originalUnknownAction = api.config.errors.unknownAction
  })

  after(async () => {
    await actionhero.stop()
    api.config.errors.unknownAction = originalUnknownAction
  })

  it('returns string errors properly', async () => {
    let {error} = await api.specHelper.runAction('notARealAction')
    expect(error).to.equal('Error: unknown action or invalid apiVersion')
  })

  it('returns Error object properly', async () => {
    api.config.errors.unknownAction = () => { return new Error('error test') }
    let {error} = await api.specHelper.runAction('notARealAction')
    expect(error).to.equal('Error: error test')
  })

  it('returns generic object properly', async () => {
    api.config.errors.unknownAction = () => { return {code: 'error111', reason: 'busted'} }

    let {error} = await api.specHelper.runAction('notARealAction')
    expect(error.code).to.equal('error111')
    expect(error.reason).to.equal('busted')
  })

  it('can have async error handlers', async () => {
    api.config.errors.unknownAction = async () => {
      return new Promise((resolve) => {
        setTimeout(() => { resolve({sleepy: true}) }, 100)
      })
    }

    let {error} = await api.specHelper.runAction('notARealAction')
    expect(error.sleepy).to.equal(true)
  })
})
