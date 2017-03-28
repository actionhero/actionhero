'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

describe('Core: API', () => {
  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      done()
    })
  })

  after((done) => {
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
      expect(api.params.postVariables.indexOf(item) >= 0).to.equal(true)
    })

    done()
  })

  describe('api versions', () => {
    before((done) => {
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

    after((done) => {
      delete api.actions.actions.versionedAction
      delete api.actions.versions.versionedAction
      done()
    })

    it('will default actions to version 1 when no version is provided by the defintion', (done) => {
      api.specHelper.runAction('randomNumber', (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).to.equal(1)
        done()
      })
    })

    it('can specify an apiVersion', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 1}, (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).to.equal(1)
        api.specHelper.runAction('versionedAction', {apiVersion: 2}, (response) => {
          expect(response.requesterInformation.receivedParams.apiVersion).to.equal(2)
          done()
        })
      })
    })

    it('will default clients to the latest version of the action', (done) => {
      api.specHelper.runAction('versionedAction', (response) => {
        expect(response.requesterInformation.receivedParams.apiVersion).to.equal(3)
        done()
      })
    })

    it('will fail on a missing action + version', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 10}, (response) => {
        expect(response.error).to.equal('Error: unknown action or invalid apiVersion')
        done()
      })
    })

    it('can return complex error responses', (done) => {
      api.specHelper.runAction('versionedAction', {apiVersion: 3}, (response) => {
        expect(response.error.a.complex).to.equal('error')
        done()
      })
    })
  })

  describe('Action Params', () => {
    before((done) => {
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
          run: function (api, connection, next) {
            connection.response.params = connection.params
            next(connection, true)
          }
        }
      }

      done()
    })

    after((done) => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
      api.config.general.missingParamChecks = [null, '', undefined]
      done()
    })

    it('correct params that are falsey (false, []) should be allowed', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: false}, (response) => {
        expect(response.params.requiredParam).to.equal(false)
        api.specHelper.runAction('testAction', {requiredParam: []}, (response) => {
          expect(response.params.requiredParam).to.have.length(0)
          done()
        })
      })
    })

    it('will fail for missing or empty string params', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: ''}, (response) => {
        expect(response.error).to.contain('required parameter for this action')
        api.specHelper.runAction('testAction', {}, (response) => {
          expect(response.error).to.match(/requiredParam is a required parameter for this action/)
          done()
        })
      })
    })

    it('correct params respect config options', (done) => {
      api.config.general.missingParamChecks = [undefined]
      api.specHelper.runAction('testAction', {requiredParam: ''}, (response) => {
        expect(response.params.requiredParam).to.equal('')
        api.specHelper.runAction('testAction', {requiredParam: null}, (response) => {
          expect(response.params.requiredParam).to.be.null()
          done()
        })
      })
    })

    it('will set a default when params are not provided', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true}, (response) => {
        expect(response.params.fancyParam).to.equal('abc123')
        done()
      })
    })

    it('will use validator if provided', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.error).to.match(/Error: fancyParam should be "abc123"/)
        done()
      })
    })

    it('validator will have the API object in scope as this', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.error).to.match(new RegExp(api.id))
        done()
      })
    })

    it('will use formatter if provided (and still use validator)', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, fancyParam: 123}, (response) => {
        expect(response.requesterInformation.receivedParams.fancyParam).to.equal('123')
        done()
      })
    })

    it('will filter params not set in the target action or global safelist', (done) => {
      api.specHelper.runAction('testAction', {requiredParam: true, sleepDuration: true}, (response) => {
        expect(response.requesterInformation.receivedParams.requiredParam).to.be.ok()
        expect(response.requesterInformation.receivedParams.sleepDuration).to.not.exist()
        done()
      })
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
                  formatter: function (s) {
                    return String(s)
                  }
                }
              }
            }
          },
          run: function (api, connection, next) {
            connection.response.params = connection.params
            next(connection, true)
          }
        }
      }
    })

    after(() => {
      delete api.actions.actions.testAction
      delete api.actions.versions.testAction
      api.config.general.missingParamChecks = [null, '', undefined]
    })

    it('correct params that are falsey (false, []) should be allowed', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: false}}, (response) => {
        expect(response.params.schemaParam.requiredParam).to.equal(false)
        api.specHelper.runAction('testAction', {schemaParam: {requiredParam: []}}, (response) => {
          expect(response.params.schemaParam.requiredParam).to.have.length(0)
          done()
        })
      })
    })

    it('will fail for missing or empty string params', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: ''}}, (response) => {
        expect(response.error).to.contain('schemaParam.requiredParam is a required parameter for this action')
        api.specHelper.runAction('testAction', {schemaParam: {}}, (response) => {
          expect(response.error).to.contain('schemaParam.requiredParam is a required parameter for this action')
          done()
        })
      })
    })

    it('correct params respect config options', (done) => {
      api.config.general.missingParamChecks = [undefined]
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: ''}}, (response) => {
        expect(response.params.schemaParam.requiredParam).to.equal('')
        api.specHelper.runAction('testAction', {schemaParam: {requiredParam: null}}, (response) => {
          expect(response.params.schemaParam.requiredParam).to.be.null()
          done()
        })
      })
    })

    it('will set a default when params are not provided', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true}}, (response) => {
        expect(response.params.schemaParam.fancyParam).to.equal('abc123')
        done()
      })
    })

    it('will use validator if provided', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}}, (response) => {
        expect(response.error).to.match(/Error: fancyParam should be "abc123"/)
        done()
      })
    })

    it('validator will have the API object in scope as this', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}}, (response) => {
        expect(response.error).to.match(new RegExp(api.id))
        done()
      })
    })

    it('will use formatter if provided (and still use validator)', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, fancyParam: 123}}, (response) => {
        expect(response.requesterInformation.receivedParams.schemaParam.fancyParam).to.equal('123')
        done()
      })
    })

    it('will filter params not set in the target action or global safelist', (done) => {
      api.specHelper.runAction('testAction', {schemaParam: {requiredParam: true, sleepDuration: true}}, (response) => {
        expect(response.requesterInformation.receivedParams.schemaParam.requiredParam).to.be.ok()
        expect(response.requesterInformation.receivedParams.schemaParam.sleepDuration).to.not.exist()
        done()
      })
    })
  })

  describe('named action validations', () => {
    before((done) => {
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

    after((done) => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api.validators
      done()
    })

    it('runs validator arrays in the proper order', (done) => {
      api.specHelper.runAction('testAction', {a: 6}, (response) => {
        expect(response.error).to.equal('Error: only strings')
        done()
      })
    })

    it('runs more than 1 validator', (done) => {
      api.specHelper.runAction('testAction', {a: 'hello'}, (response) => {
        expect(response.error).to.equal('Error: that is not correct')
        done()
      })
    })

    it('succeeds multiple validators', (done) => {
      api.specHelper.runAction('testAction', {a: 'correct'}, (response) => {
        expect(response.error).to.not.exist()
        done()
      })
    })
  })

  describe('named action formatters', () => {
    before((done) => {
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

    after((done) => {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction
      delete api.formatters
      done()
    })

    it('runs formatter arrays in the proper order', (done) => {
      api.specHelper.runAction('testAction', {a: 6}, (response) => {
        expect(response.a).to.equal('~*6*~')
        done()
      })
    })
  })
})
