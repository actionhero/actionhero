'use strict'

var fs = require('fs')
var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

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

describe('Core: Developer Mode', function () {
  beforeAll((done) => {
    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      setTimeout(function () {
        done()
      }, 1001) // allow the file to get stat-ed once in the original state
    })
  })

  afterAll((done) => {
    actionhero.stop(() => {
      fs.writeFile(originalFile, String(originalContent), function () {
        setTimeout(function () {
          done()
        }, 1001 * 3)
      })
    })
  })

  it('random numbers work initially', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      should.not.exist(response.error)
      response.randomNumber.should.be.within(0, 1)
      done()
    })
  })

  it('I can change the file and new actions will be loaded up', (done) => {
    fs.writeFile(originalFile, newFileContent, function () {
      setTimeout(function () {
        api.actions.actions.randomNumber['1'].description.should.equal('HACK')
        api.specHelper.runAction('randomNumber', (response) => {
          response.randomNumber.should.equal('not a number!')
          done()
        })
      }, 1001 * 3) // file read timer is 1 second; time to notice the change + 3x time to reload API
    })
  })

  it('It can be placed back', (done) => {
    fs.writeFile(originalFile, originalContent, function () {
      setTimeout(function () {
        api.actions.actions.randomNumber['1'].description.should.equal('I am an API method which will generate a random number')
        done()
      }, 1001 * 3) // file read timer is 1 second; time to notice the change + 3x time to reload API
    })
  })
})
