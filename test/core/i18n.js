'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api
let originalDetermineConnectionLocale

const readLocaleFile = (locale) => {
  let file = api.config.general.paths.locale[0] + '/' + locale + '.json'
  let contents = String(fs.readFileSync(file))
  let json = JSON.parse(contents)
  return json
}

const spanish = {
  'Your random number is {{number}}': 'Su número aleatorio es {{number}}',
  actionhero: {
    errors: {
      missingParams: '{{param}} es un parámetro requerido para esta acción',
      fileNotFound: 'Ese archivo no se encuentra'
    }
  }
}

const sleep = async (timeout) => { await promisify(setTimeout)(timeout) }

fs.writeFileSync(path.join(__dirname, '/../../locales/test-env-es.json'), JSON.stringify(spanish, null, 2))

describe('Core: i18n', () => {
  before(async () => {
    await sleep(500) // sleep to ensure normal local files are saved to disk
    api = await actionhero.start()
    originalDetermineConnectionLocale = api.i18n.determineConnectionLocale

    let options = api.config.i18n
    options.directory = api.config.general.paths.locale[0]
    options.locales = ['test-env-en', 'test-env-es']
    options.defaultLocale = 'test-env-en'
    api.i18n.configure(options)
  })

  after(async () => {
    fs.unlinkSync(path.join(__dirname, '/../../locales/test-env-en.json'))
    fs.unlinkSync(path.join(__dirname, '/../../locales/test-env-es.json'))
    await actionhero.stop()
    api.i18n.determineConnectionLocale = originalDetermineConnectionLocale
  })

  it('should create localization files by default, and strings from actions should be included', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.most(1)
    expect(randomNumber).to.be.at.least(0)

    let content = readLocaleFile('test-env-en');

    [
      'Your random number is {{number}}'
    ].forEach((s) => {
      expect(content[s]).to.equal(s)
    })
  })

  it('should respect the content of the localization files for generic messages to connections', async () => {
    let response

    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    response = await api.specHelper.runAction('randomNumber')
    expect(response.stringRandomNumber).to.match(/Your random number is/)

    api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
    response = await api.specHelper.runAction('randomNumber')
    expect(response.stringRandomNumber).to.match(/Su número aleatorio es/)
  })

  it('should respect the content of the localization files for api errors to connections or use defaults', async () => {
    let response
    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    response = await api.specHelper.runAction('cacheTest')
    expect(response.error).to.equal('Error: actionhero.errors.missingParams')

    api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
    response = await api.specHelper.runAction('cacheTest')
    expect(response.error).to.match(/key es un parámetro requerido para esta acción/)
  })

  it('should respect the content of the localization files for http errors to connections or use defaults', async () => {
    let response
    api.i18n.determineConnectionLocale = () => { return 'test-env-en' }
    response = await api.specHelper.getStaticFile('missing-file.html')
    expect(response.error).to.equal('actionhero.errors.fileNotFound')

    api.i18n.determineConnectionLocale = () => { return 'test-env-es' }
    response = await api.specHelper.getStaticFile('missing-file.html')
    expect(response.error).to.match(/Ese archivo no se encuentra/)
  })

  it('determineConnectionLocale cannot be an async method', async () => {
    api.i18n.determineConnectionLocale = async () => {
      await sleep(1)
      return 'test-env-es'
    }

    let response = await api.specHelper.getStaticFile('missing-file.html')
    expect(response.error).to.match(/actionhero.errors.fileNotFound/) // should this have worked, it would have been in Spanish
  })
})
