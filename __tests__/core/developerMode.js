'use strict'

var fs = require('fs')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

require = require.requireActual // eslint-disable-line

var originalFile = './actions/randomNumber.js'
var originalContent = fs.readFileSync(originalFile)

var newFileContent = ''
newFileContent += 'exports.randomNumber = {'
newFileContent += '  name: "randomNumber",'
newFileContent += '  description: "HACK",'
newFileContent += '  outputExample: {},'
newFileContent += '  run: function(api, connection, next){'
newFileContent += '    connection.response.randomNumber = "not a number!";'
newFileContent += '    next(connection, true);'
newFileContent += '  }'
newFileContent += '};'

describe('Core: Developer Mode', () => {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      setTimeout(done, 1001) // allow the file to get stat-ed once in the original state
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      fs.writeFileSync(originalFile, originalContent)
      setTimeout(done, 1001 * 3)
    })
  })

  it('random numbers work initially', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.error).toBeUndefined()
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      done()
    })
  })

  describe('with new file', () => {
    beforeAll((done) => {
      fs.writeFile(originalFile, newFileContent, done)
    })

    // TODO Jest doesn't seem to allow us to reload a file via require?
    it('I can change the file and new actions will be loaded up')
    // it('I can change the file and new actions will be loaded up', (done) => {
    //   setTimeout(() => {
    //     expect(api.actions.actions.randomNumber['1'].description).toBe('HACK')
    //     api.specHelper.runAction('randomNumber', (response) => {
    //       expect(response.randomNumber).toBe('not a number!')
    //       done()
    //     })
    //   }, 3001) // file read timer is 1 second; time to notice the change + 3x time to reload API
    // }, 10000)
  })

  it('It can be placed back', (done) => {
    fs.writeFileSync(originalFile, originalContent)
    setTimeout(() => {
      expect(api.actions.actions.randomNumber['1'].description).toBe('I am an API method which will generate a random number')
      done()
    }, 3001) // file read timer is 1 second; time to notice the change + 3x time to reload API
  }, 10000)

  it('works as it did originally', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.error).toBeUndefined()
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      done()
    })
  })
})
