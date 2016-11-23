'use strict'

var fs = require('fs')
var should = require('should')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var tmpPath = require('os').tmpdir() + require('path').sep + 'locale' + require('path').sep

var readLocaleFile = function (locale) {
  if (!locale) { locale = api.config.i18n.defaultLocale }
  var file = api.config.general.paths.locale[0] + '/' + locale + '.json'
  var contents = String(fs.readFileSync(file))
  var json = JSON.parse(contents)
  return json
}

describe('Core: i18n', function () {
  before((done) => {
    // sleep to ensure normal local files are saved to disk
    setTimeout(done, 500)
  })

  before(function (done) {
    var spanish = {
      'Your random number is %s': 'Su número aleatorio es %s',
      'That file is not found': 'Ese archivo no se encuentra',
      '%s is a required parameter for this action': '%s es un parámetro requerido para esta acción'
    }
    fs.writeFileSync(tmpPath + 'es.json', JSON.stringify(spanish))

    actionhero.start(function (error, a) {
      should.not.exist(error)
      api = a
      var options = api.config.i18n
      options.directory = api.config.general.paths.locale[0]
      options.locales = ['en', 'es']
      api.i18n.configure(options)
      done()
    })
  })

  after(function (done) {
    // api.utils.deleteDirectorySync( api.config.general.paths.locale[0] );
    actionhero.stop(function () {
      done()
    })
  })

  it('should create localization files by default, and strings from actions should be included', function (done) {
    api.specHelper.runAction('randomNumber', function (response) {
      response.randomNumber.should.be.within(0, 1)
      var content = readLocaleFile();
      [
        'Your random number is %s'
      ].forEach(function (s) {
        should.exist(content[s])
        content[s].should.equal(s)
      })
      done()
    })
  })

  // to test this we would need to temporarliy enable logging for the test ENV...
  it('should should respect the content of the localization files for the server logs')

  it('should should respect the content of the localization files for generic messages to connections', function (done) {
    api.i18n.determineConnectionLocale = function () { return 'en' }
    api.specHelper.runAction('randomNumber', function (response) {
      response.stringRandomNumber.should.match(/Your random number is/)

      api.i18n.determineConnectionLocale = function () { return 'es' }
      api.specHelper.runAction('randomNumber', function (response) {
        response.stringRandomNumber.should.match(/Su número aleatorio es/)
        done()
      })
    })
  })

  it('should should respect the content of the localization files for api errors to connections', function (done) {
    api.i18n.determineConnectionLocale = function () { return 'en' }
    api.specHelper.runAction('cacheTest', function (response) {
      response.error.should.match(/key is a required parameter for this action/)

      api.i18n.determineConnectionLocale = function () { return 'es' }
      api.specHelper.runAction('cacheTest', function (response) {
        response.error.should.match(/key es un parámetro requerido para esta acción/)
        done()
      })
    })
  })

  it('should should respect the content of the localization files for http errors to connections', function (done) {
    api.i18n.determineConnectionLocale = function () { return 'en' }
    api.specHelper.getStaticFile('missing-file.html', function (data) {
      data.error.should.match(/That file is not found/)

      api.i18n.determineConnectionLocale = function () { return 'es' }
      api.specHelper.getStaticFile('missing-file.html', function (data) {
        data.error.should.match(/Ese archivo no se encuentra/)
        done()
      })
    })
  })
})
