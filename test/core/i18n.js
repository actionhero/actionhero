'use strict'

var chai = require('chai')
var dirtyChai = require('dirty-chai')
var expect = chai.expect
chai.use(dirtyChai)

var fs = require('fs')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var readLocaleFile = (locale) => {
  var file = api.config.general.paths.locale[0] + '/' + locale + '.json'
  var contents = String(fs.readFileSync(file))
  var json = JSON.parse(contents)
  return json
}

var spanish = {
  'Your random number is {{number}}': 'Su número aleatorio es {{number}}',
  actionhero: {
    errors: {
      missingParams: '{{param}} es un parámetro requerido para esta acción',
      fileNotFound: 'Ese archivo no se encuentra'
    }
  }
}

fs.writeFileSync(path.join(__dirname, '/../../locales/test-env-es.json'), JSON.stringify(spanish, null, 2))

describe('Core: i18n', () => {
  before((done) => {
    // sleep to ensure normal local files are saved to disk
    setTimeout(done, 500)
  })

  before((done) => {
    actionhero.start((error, a) => {
      expect(error).to.be.null()
      api = a
      var options = api.config.i18n
      options.directory = api.config.general.paths.locale[0]
      options.locales = ['test-env-en', 'test-env-es']
      options.defaultLocale = 'test-env-en'
      api.i18n.configure(options)
      done()
    })
  })

  after((done) => {
    fs.unlinkSync(path.join(__dirname, '/../../locales/test-env-en.json'))
    fs.unlinkSync(path.join(__dirname, '/../../locales/test-env-es.json'))
    actionhero.stop(() => {
      done()
    })
  })

  it('should create localization files by default, and strings from actions should be included', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).to.be.at.most(1)
      expect(response.randomNumber).to.be.at.least(0)
      var content = readLocaleFile('test-env-en');
      [
        'Your random number is {{number}}'
      ].forEach((s) => {
        expect(content[s]).to.equal(s)
      })
      done()
    })
  })

  it('should respect the content of the localization files for generic messages to connections', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.stringRandomNumber).to.match(/Your random number is/)

      api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
      api.specHelper.runAction('randomNumber', (response) => {
        expect(response.stringRandomNumber).to.match(/Su número aleatorio es/)
        done()
      })
    })
  })

  it('should respect the content of the localization files for api errors to connections or use defaults', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    api.specHelper.runAction('cacheTest', (response) => {
      expect(response.error).to.equal('Error: actionhero.errors.missingParams')

      api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
      api.specHelper.runAction('cacheTest', (response) => {
        expect(response.error).to.match(/key es un parámetro requerido para esta acción/)
        done()
      })
    })
  })

  it('should respect the content of the localization files for http errors to connections or use defaults', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    api.specHelper.getStaticFile('missing-file.html', (data) => {
      expect(data.error).to.equal('actionhero.errors.fileNotFound')

      api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
      api.specHelper.getStaticFile('missing-file.html', (data) => {
        expect(data.error).to.match(/Ese archivo no se encuentra/)
        done()
      })
    })
  })
})
