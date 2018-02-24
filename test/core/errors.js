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
let originalGenericError

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

describe('Core: Errors: Custom Error Decoration', () => {
  let errorMsg = 'worst action ever!'
  before(async () => {
    api = await actionhero.start()
    originalGenericError = api.config.errors.genericError
    api.actions.versions.errorAction = [1]
    api.actions.actions.errorAction = {
      '1': {
        name: 'errorAction',
        description: 'this action throws errors',
        version: 1,
        inputs: {},
        run: async (data) => {
          throw new Error(errorMsg)
        }
      }
    }
  })

  after(async () => {
    await actionhero.stop()
    delete api.actions.actions.errorAction
    delete api.actions.versions.errorAction
    api.config.errors.genericError = originalGenericError
  })

  it('will return an actions error', async () => {
    let response = await api.specHelper.runAction('errorAction')
    expect(response.error).to.equal('Error: worst action ever!')
    expect(response.requestId).to.not.exist()
  })

  it('can decorate an error', async () => {
    api.config.errors.genericError = async (data, error) => {
      data.response.requestId = 'id-12345'
      return error
    }
    let response = await api.specHelper.runAction('errorAction')
    expect(response.error).to.equal('Error: worst action ever!')
    expect(response.requestId).to.equal('id-12345')
  })
})
