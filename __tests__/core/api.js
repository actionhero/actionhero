'use strict'

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: API', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      done()
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      done()
    })
  })

  it('should have an api object with proper parts', (done) => {
    [
      api.actions.actions,
      api.actions.versions,
      api.actions.actions.cacheTest['1'],
      api.actions.actions.randomNumber['1'],
      api.actions.actions.status['1']
    ].forEach((item) => {
      expect(item).toBeInstanceOf(Object)
    });

    [
      api.actions.actions.cacheTest['1'].run,
      api.actions.actions.randomNumber['1'].run,
      api.actions.actions.status['1'].run
    ].forEach((item) => {
      expect(item).toBeInstanceOf(Function)
    });

    [
      api.actions.actions.randomNumber['1'].name,
      api.actions.actions.randomNumber['1'].description
    ].forEach((item) => {
      expect(typeof item).toBe('string')
    })

    expect(api.config).toBeInstanceOf(Object)

    done()
  })

  it('should have loaded postVariables properly', (done) => {
    [
      'file',
      'callback',
      'action',
      'apiVersion',
      'key',  // from cacheTest action
      'value' // from cacheTest action
    ].forEach((item) => {
      expect(api.params.postVariables.indexOf(item) >= 0).toBe(true)
    })

    done()
  })

  describe('api versions', () => {
    beforeAll((done) => {
      api.actions.versions.versionedAction = [1, 2, 3]
      api.actions.actions.versionedAction = {
        '1': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 1,
          outputExample: {},
          run: function (api, connection, next) {
            connection.response.version = 1
            next(connection, true)
          }
        },
        '2': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 2,
          outputExample: {},
          run: function (api, connection, next) {
            connection.response.version = 1
            next(connection, true)
          }
        },
        '3': {
          name: 'versionedAction',
          description: 'I am a test',
          version: 3,
          outputExample: {},
          run: (api, data, next) => {
            data.response.version = 1
            var error = {
              'a': {'complex': 'error'}
            }
            next(error)
          }
        }
      }
      done()
    })

    afterAll((done) => {
      delete api.actions.actions.versionedAction
      delete api.actions.versions.versionedAction
      done()
    })

    it('will default actions to version 1 when no version is provided by the defintion', (done) => {
      api.specHelper.runAction('randomNumber', (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).toBe(1)
        done()
      })
    })

    it('can specify an apiVersion', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 1}, (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).toBe(1)
        api.specHelper.runAction('versionedAction', {apiVersion: 2}, (response) => {
          expect(response.requesterInformation.receivedParams.apiVersion).toBe(2)
          done()
        })
      })
    })

    it('will default clients to the latest version of the action', (done) => {
      api.specHelper.runAction('versionedAction', (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).toBe(3)
        done()
      })
    })

    it('will fail on a missing action + version', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 10}, (response) => {
        expect(response.error).toBe('Error: unknown action or invalid apiVersion')
        done()
      })
    })

    it('can return complex error responses', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 3}, (response) => {
        expect(response.error.a.complex).toBe('error')
        done()
      })
    })
  })

  describe('Action Params', () => {
    beforeAll((done) => {
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
              default: function () { return 'abc123' },
              validator: function (s) {
                if (s === 'abc123') { return true } else { return 'fancyParam should be "abc123".  so says ' + this.id }
              },
              formatter: function (s) {
                return String(s)
              }
            }
          },
          run: function (api, connection, next) {
            connection.response.params = connection.params
            next(connection, true)
          }
        }
      }

      done()
    })

    afterAll((done) => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
      done()
    })

    it('correct params that are falsey (false, []) should be allowed', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: false}, (response) => {
        expect(response.params.requiredParam).toBe(false)
        api.specHelper.runAction('testAction', {requiredParam: []}, (response) => {
          expect(response.params.requiredParam).toHaveLength(0)
          done()
        })
      })
    })

    it('will fail for missing or empty string params', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: ''}, (response) => {
        expect(response.error).toContain('required parameter for this action')
        api.specHelper.runAction('testAction', {}, (response) => {
          expect(response.error).toMatch(/requiredParam is a required parameter for this action/)
          done()
        })
      })
    })

    it('correct params respect config options', (done) => {
      api.config.general.missingParamChecks = [undefined]
      api.specHelper.runAction('testAction', {requiredParam: ''}, (response) => {
        expect(response.params.requiredParam).toBe('')
        api.specHelper.runAction('testAction', {requiredParam: null}, (response) => {
          expect(response.params.requiredParam).toBeNull()
          done()
        })
      })
    })

    it('will set a default when params are not provided', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true}, (response) => {
        expect(response.params.fancyParam).toBe('abc123')
        done()
      })
    })

    it('will use validator if provided', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.error).toMatch(/Error: fancyParam should be "abc123"/)
        done()
      })
    })

    it('validator will have the API object in scope as this', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.error).toMatch(new RegExp(api.id))
        done()
      })
    })

    it('will use formatter if provided (and still use validator)', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.requesterInformation.receivedParams.fancyParam).toBe('123')
        done()
      })
    })

    it('will filter params not set in the target action or global safelist', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, sleepDuration: true}, (response) => {
        expect(response.requesterInformation.receivedParams.requiredParam).toBeTruthy()
        expect(response.requesterInformation.receivedParams.sleepDuration).toBeUndefined()
        done()
      })
    })
  })

  describe('named action validations', function () {
    beforeAll((done) => {
      api.validators = {
        validator1: function (param) {
          if (typeof param !== 'string') { return new Error('only strings') }
          return true
        },
        validator2: function (param) {
          if (param !== 'correct') { return new Error('that is not correct') }
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
          run: (api, data, next) => {
            next()
          }
        }
      }

      done()
    })

    afterAll((done) => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api.validators
      done()
    })

    it('runs validator arrays in the proper order', (done) => {
      api.specHelper.runAction('testAction', {a: 6}, (response) => {
        expect(response.error).toBe('Error: only strings')
        done()
      })
    })

    it('runs more than 1 validator', (done) => {
      api.specHelper.runAction('testAction', {a: 'hello'}, (response) => {
        expect(response.error).toBe('Error: that is not correct')
        done()
      })
    })

    it('succeeds multiple validators', (done) => {
      api.specHelper.runAction('testAction', {a: 'correct'}, (response) => {
        expect(response.error).toBeUndefined()
        done()
      })
    })
  })

  describe('named action formatters', () => {
    beforeAll((done) => {
      api.formatters = {
        formatter1: function (param) {
          return '*' + param + '*'
        },
        formatter2: function (param) {
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
              formatter: ['api.formatters.formatter1', 'api.formatters.formatter2']
            }
          },
          run: (api, data, next) => {
            data.response.a = data.params.a
            next()
          }
        }
      }

      done()
    })

    afterAll((done) => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api.formatters
      done()
    })

    it('runs formatter arrays in the proper order', (done) => {
      api.specHelper.runAction('testAction', {a: 6}, (response) => {
        expect(response.a).toBe('~*6*~')
        done()
      })
    })
  })
})
