'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()

let api
let originalUnknownAction
let originalGenericError

describe('Core', () => {
  describe('errors', () => {
    beforeAll(async () => {
      api = await actionhero.start()
      originalUnknownAction = api.config.errors.unknownAction
    })

    afterAll(async () => {
      await actionhero.stop()
      api.config.errors.unknownAction = originalUnknownAction
    })

    test('returns string errors properly', async () => {
      const { error } = await api.specHelper.runAction('notARealAction')
      expect(error).toEqual('Error: unknown action or invalid apiVersion')
    })

    test('returns Error object properly', async () => {
      api.config.errors.unknownAction = () => { return new Error('error test') }
      const { error } = await api.specHelper.runAction('notARealAction')
      expect(error).toEqual('Error: error test')
    })

    test('returns generic object properly', async () => {
      api.config.errors.unknownAction = () => { return { code: 'error111', reason: 'busted' } }

      const { error } = await api.specHelper.runAction('notARealAction')
      expect(error.code).toEqual('error111')
      expect(error.reason).toEqual('busted')
    })

    test('can have async error handlers', async () => {
      api.config.errors.unknownAction = async () => {
        return new Promise((resolve) => {
          setTimeout(() => { resolve({ sleepy: true }) }, 100)
        })
      }

      const { error } = await api.specHelper.runAction('notARealAction')
      expect(error.sleepy).toEqual(true)
    })
  })

  describe('Core: Errors: Custom Error Decoration', () => {
    const errorMsg = 'worst action ever!'
    beforeAll(async () => {
      api = await actionhero.start()
      originalGenericError = api.config.errors.genericError
      api.actions.versions.errorAction = [1]
      api.actions.actions.errorAction = {
        1: {
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

    afterAll(async () => {
      await actionhero.stop()
      delete api.actions.actions.errorAction
      delete api.actions.versions.errorAction
      api.config.errors.genericError = originalGenericError
    })

    test('will return an actions error', async () => {
      const response = await api.specHelper.runAction('errorAction')
      expect(response.error).toEqual('Error: worst action ever!')
      expect(response.requestId).toBeUndefined()
    })

    test('can decorate an error', async () => {
      api.config.errors.genericError = async (data, error) => {
        data.response.requestId = 'id-12345'
        return error
      }
      const response = await api.specHelper.runAction('errorAction')
      expect(response.error).toEqual('Error: worst action ever!')
      expect(response.requestId).toEqual('id-12345')
    })
  })
})
