'use strict'

var fs = require('fs')
let path = require('path')
var ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
var actionhero = new ActionheroPrototype()
var api

var tmpPath = require('os').tmpdir() + require('path').sep + 'locale' + require('path').sep

var readLocaleFile = (locale) => {
  if (!locale) { locale = api.config.i18n.defaultLocale }
  var file = api.config.general.paths.locale[0] + '/' + locale + '.json'
  var contents = String(fs.readFileSync(file))
  var json = JSON.parse(contents)
  return json
}

describe('Core: i18n', () => {
  beforeAll((done) => {
    // sleep to ensure normal local files are saved to disk
    setTimeout(done, 500)
  })

  beforeAll((done) => {
    var spanish = {
      'Your random number is %s': 'Su número aleatorio es %s',
      'That file is not found': 'Ese archivo no se encuentra',
      '%s is a required parameter for this action': '%s es un parámetro requerido para esta acción'
    }
    fs.writeFileSync(tmpPath + 'es.json', JSON.stringify(spanish))

    actionhero.start((error, a) => {
      expect(error).toBeNull()
      api = a
      var options = api.config.i18n
      options.directory = api.config.general.paths.locale[0]
      options.locales = ['en', 'es']
      api.i18n.configure(options)
      done()
    })
  })

  afterAll((done) => {
    // api.utils.deleteDirectorySync( api.config.general.paths.locale[0] );
    actionhero.stop(() => {
      done()
    })
  })

  it('should create localization files by default, and strings from actions should be included', (done) => {
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.randomNumber).toBeLessThanOrEqual(1)
      expect(response.randomNumber).toBeGreaterThanOrEqual(0)
      var content = readLocaleFile();
      [
        'Your random number is %s'
      ].forEach((s) => {
        expect(content[s]).toBe(s)
      })
      done()
    })
  })

  // to test this we would need to temporarliy enable logging for the test ENV...
  it('should respect the content of the localization files for the server logs')

  it('should respect the content of the localization files for generic messages to connections', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'en' }
    api.specHelper.runAction('randomNumber', (response) => {
      expect(response.stringRandomNumber).toMatch(/Your random number is/)

      api.i18n.determineConnectionLocale = () => { return 'es' }
      api.specHelper.runAction('randomNumber', (response) => {
        expect(response.stringRandomNumber).toMatch(/Su número aleatorio es/)
        done()
      })
    })
  })

  it('should respect the content of the localization files for api errors to connections', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'en' }
    api.specHelper.runAction('cacheTest', (response) => {
      expect(response.error).toMatch(/key is a required parameter for this action/)

      api.i18n.determineConnectionLocale = () => { return 'es' }
      api.specHelper.runAction('cacheTest', (response) => {
        expect(response.error).toMatch(/key es un parámetro requerido para esta acción/)
        done()
      })
    })
  })

  it('should respect the content of the localization files for http errors to connections', (done) => {
    api.i18n.determineConnectionLocale = () => { return 'en' }
    api.specHelper.getStaticFile('missing-file.html', (data) => {
      expect(data.error).toMatch(/That file is not found/)

      api.i18n.determineConnectionLocale = () => { return 'es' }
      api.specHelper.getStaticFile('missing-file.html', (data) => {
        expect(data.error).toMatch(/Ese archivo no se encuentra/)
        done()
      })
    })
  })
})
