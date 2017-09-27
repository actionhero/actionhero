'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Core: API', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('should have an api object with proper parts', () => {
    [
      api.actions.actions,
      api.actions.versions,
      api.actions.actions.cacheTest['1'],
      api.actions.actions.randomNumber['1'],
      api.actions.actions.status['1']
    ].forEach((item) => {
      expect(item).to.be.instanceof(Object)
    });

    [
      api.actions.actions.cacheTest['1'].run,
      api.actions.actions.randomNumber['1'].run,
      api.actions.actions.status['1'].run
    ].forEach((item) => {
      expect(item).to.be.instanceof(Function)
    });

    [
      api.actions.actions.randomNumber['1'].name,
      api.actions.actions.randomNumber['1'].description
    ].forEach((item) => {
      expect(typeof item).to.equal('string')
    })

    expect(api.config).to.be.instanceof(Object)
  })

  it('should have loaded postVariables properly', () => {
    [
      'file',
      'callback',
      'action',
      'apiVersion',
      'key',  // from cacheTest action
      'value' // from cacheTest action
    ].forEach((item) => {
      expect(api.params.postVariables.indexOf(item) >= 0).to.equal(true)
    })
  })

  describe('api versions', () => {
    before(() => {
      api.actions.versions.versionedAction = [1, 2, 3]
      api.actions.actions.versionedAction = {
        '1': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: async (data) => {
            data.response.version = 1
          }
        },
        '2': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 2,
          outputExample: {},
          run: async (data) => {
            data.response.version = 2
          }
        },
        '3': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 3,
          outputExample: {},
          run: async (data) => {
            data.response.version = 3
            data.response.error = {
              'a': {'complex': 'error'}
            }
          }
        }
      }
    })

    after(() => {
      delete api.actions.actions.versionedAction
      delete api.actions.versions.versionedAction
    })

    it('will default actions to version 1 when no version is provided by the defintion', async () => {
      let response = await api.specHelper.runAction('randomNumber')
      expect(response.requesterInformation.receivedParams.apiVersion).to.equal(1)
    })

    it('can specify an apiVersion', async () => {
      let response
      response = await api.specHelper.runAction('versionedAction', {apiVersion: 1})
      expect(response.requesterInformation.receivedParams.apiVersion).to.equal(1)
      response = await api.specHelper.runAction('versionedAction', {apiVersion: 2})
      expect(response.requesterInformation.receivedParams.apiVersion).to.equal(2)
    })

    it('will default clients to the latest version of the action', async () => {
      let response = await api.specHelper.runAction('versionedAction')
      expect(response.requesterInformation.receivedParams.apiVersion).to.equal(3)
    })

    it('will fail on a missing action + version', async () => {
      let response = await api.specHelper.runAction('versionedAction', {apiVersion: 10})
      expect(response.error).to.equal('Error: unknown action or invalid apiVersion')
    })

    it('can return complex error responses', async () => {
      let response = await api.specHelper.runAction('versionedAction', {apiVersion: 3})
      expect(response.error.a.complex).to.equal('error')
    })
  })

  describe('action constructor', () => {
    it('validates actions', () => {
      class GoodAction extends ActionHero.Action {
        constructor () {
          super()
          this.name = 'good'
          this.description = 'good'
          this.outputExample = {}
        }
        async run () {}
      }

      class BadAction extends ActionHero.Action {
        constructor () {
          super()
          // this.name = 'bad'
          this.description = 'bad'
          this.outputExample = {}
        }
        async run () {}
      }

      let goodAction = new GoodAction()
      let badAction = new BadAction()

      goodAction.validate()

      try {
        badAction.validate()
        throw new Error('should not get here')
      } catch (error) {
        expect(error.toString()).to.match(/name is required for this action/)
      }
    })
  })

  describe('Action Params', () => {
    before(() => {
      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: {
            requiredParam: {required: true},
            optionalParam: {required: false},
            fancyParam: {
              required: false,
              default: () => { return 'abc123' },
              validator: function (s) {
                if (s === 'abc123') { return true } else { return 'fancyParam should be "abc123".  so says ' + this.id }
              },
              formatter: function (s) {
                return String(s)
              }
            }
          },
          run: async (data) => {
            data.response.params = data.params
          }
        }
      }
    })

    after(() => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
      api.config.general.missingParamChecks = [null, '', undefined]
    })

    it('correct params that are falsey (false, []) should be allowed', async () => {
      let response
      response = await api.specHelper.runAction('testAction', {requiredParam: false})
      expect(response.params.requiredParam).to.equal(false)
      response = await api.specHelper.runAction('testAction', {requiredParam: []})
      expect(response.params.requiredParam).to.have.length(0)
    })

    it('will fail for missing or empty string params', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: ''})
      expect(response.error).to.contain('required parameter for this action')
      response = await api.specHelper.runAction('testAction', {})
      expect(response.error).to.match(/requiredParam is a required parameter for this action/)
    })

    it('correct params respect config options', async () => {
      let response
      api.config.general.missingParamChecks = [undefined]
      response = await api.specHelper.runAction('testAction', {requiredParam: ''})
      expect(response.params.requiredParam).to.equal('')
      response = await api.specHelper.runAction('testAction', {requiredParam: null})
      expect(response.params.requiredParam).to.be.null()
    })

    it('will set a default when params are not provided', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: true})
      expect(response.params.fancyParam).to.equal('abc123')
    })

    it('will use validator if provided', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123})
      expect(response.error).to.match(/Error: fancyParam should be "abc123"/)
    })

    it('validator will have the API object in scope as this', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123})
      expect(response.error).to.match(new RegExp(api.id))
    })

    it('will use formatter if provided (and still use validator)', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123})
      expect(response.requesterInformation.receivedParams.fancyParam).to.equal('123')
    })

    it('will filter params not set in the target action or global safelist', async () => {
      let response = await api.specHelper.runAction('testAction', {requiredParam: true, sleepDuration: true})
      expect(response.requesterInformation.receivedParams.requiredParam).to.be.ok()
      expect(response.requesterInformation.receivedParams.sleepDuration).to.not.exist()
    })
  })

  describe('Action Params schema type', () => {
    before(() => {
      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: {
            schemaParam: {
              schema: {
                requiredParam: {required: true},
                optionalParam: {required: false},
                fancyParam: {
                  required: false,
                  default: () => { return 'abc123' },
                  validator: function (s) {
                    if (s === 'abc123') { return true } else { return 'fancyParam should be "abc123".  so says ' + this.id }
                  },
                  formatter: (s) => {
                    return String(s)
                  }
                }
              }
            }
          },
          run: function async (data) {
            data.response.params = data.params
          }
        }
      }
    })

    after(() => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
      api.config.general.missingParamChecks = [null, '', undefined]
    })

    it('correct params that are falsey (false, []) should be allowed', async () => {
      let response
      response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: false}})
      expect(response.params.schemaParam.requiredParam).to.equal(false)
      response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: []}})
      expect(response.params.schemaParam.requiredParam).to.have.length(0)
    })

    it('will fail for missing or empty string params', async () => {
      let response
      response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: ''}})
      expect(response.error).to.contain('schemaParam.requiredParam is a required parameter for this action')
      response = await api.specHelper.runAction('testAction', {schemaParam: {}})
      expect(response.error).to.contain('schemaParam.requiredParam is a required parameter for this action')
    })

    it('correct params respect config options', async () => {
      let response
      api.config.general.missingParamChecks = [undefined]
      response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: ''}})
      expect(response.params.schemaParam.requiredParam).to.equal('')
      response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: null}})
      expect(response.params.schemaParam.requiredParam).to.be.null()
    })

    it('will set a default when params are not provided', async () => {
      let response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true}})
      expect(response.params.schemaParam.fancyParam).to.equal('abc123')
    })

    it('will use validator if provided', async () => {
      let response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}})
      expect(response.error).to.match(/Error: fancyParam should be "abc123"/)
    })

    it('validator will have the API object in scope as this', async () => {
      let response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}})
      expect(response.error).to.match(new RegExp(api.id))
    })

    it('will use formatter if provided (and still use validator)', async () => {
      let response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}})
      expect(response.requesterInformation.receivedParams.schemaParam.fancyParam).to.equal('123')
    })

    it('will filter params not set in the target action or global safelist', async () => {
      let response = await api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, sleepDuration: true}})
      expect(response.requesterInformation.receivedParams.schemaParam.requiredParam).to.be.ok()
      expect(response.requesterInformation.receivedParams.schemaParam.sleepDuration).to.not.exist()
    })
  })

  describe('named action validations', () => {
    before(() => {
      api.validators = {
        validator1: (param) => {
          if (typeof param !== 'string') { throw new Error('only strings') }
          return true
        },
        validator2: (param) => {
          if (param !== 'correct') { throw new Error('that is not correct') }
          return true
        }
      }

      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'I am a test',
          inputs: {
            a: {
              validator: ['api.validators.validator1', 'api.validators.validator2']
            }
          },
          run: (data) => { }
        }
      }
    })

    after(() => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api.validators
    })

    it('runs validator arrays in the proper order', async () => {
      let response = await api.specHelper.runAction('testAction', {a: 6})
      expect(response.error).to.equal('Error: only strings')
    })

    it('runs more than 1 validator', async () => {
      let response = await api.specHelper.runAction('testAction', {a: 'hello'})
      expect(response.error).to.equal('Error: that is not correct')
    })

    it('succeeds multiple validators', async () => {
      let response = await api.specHelper.runAction('testAction', {a: 'correct'})
      expect(response.error).to.not.exist()
    })
  })

  describe('named action formatters', () => {
    before(() => {
      api._formatters = {
        formatter1: (param) => {
          return '*' + param + '*'
        },
        formatter2: (param) => {
          return '~' + param + '~'
        }
      }

      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'I am a test',
          inputs: {
            a: {
              formatter: ['api._formatters.formatter1', 'api._formatters.formatter2']
            }
          },
          run: async (data) => {
            data.response.a = data.params.a
          }
        }
      }
    })

    after(() => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api._formatters
    })

    it('runs formatter arrays in the proper order', async () => {
      let response = await api.specHelper.runAction('testAction', {a: 6})
      expect(response.a).to.equal('~*6*~')
    })
  })

  describe('immutability of data.params', () => {
    before(() => {
      api.actions.versions.testAction = [1]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'I am a test',
          inputs: {
            a: {required: true}
          },
          run: async ({params, response}) => {
            params.a = 'changed!'
            response.a = params.a
          }
        }
      }
    })

    after(() => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
    })

    it('prevents data.params from being modified', async () => {
      let response = await api.specHelper.runAction('testAction', {a: 'original'})
      expect(response.a).to.not.exist()
      expect(response.error).to.match(/Cannot assign to read only property 'a' of object/)
    })
  })
})
