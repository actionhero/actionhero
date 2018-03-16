'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const fs = require('fs')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

require = require.requireActual // eslint-disable-line

const originalFile = './actions/randomNumber.js'
const originalContent = fs.readFileSync(originalFile)

let newFileContent = ''
newFileContent += 'const ActionHero = require(\'./../index.js\')\n'
newFileContent += 'module.exports = class RandomNumber extends ActionHero.Action {\n'
newFileContent += '  constructor () {\n'
newFileContent += '    super()\n'
newFileContent += '    this.name = \'randomNumber\'\n'
newFileContent += '    this.description = \'HACK\'\n'
newFileContent += '  }\n'
newFileContent += '  async run (data) {\n'
newFileContent += '    data.response.randomNumber = "not a number!"\n'
newFileContent += '  }\n'
newFileContent += '}\n'

async function sleep (time) {
  await new Promise((resolve) => { setTimeout(resolve, time) })
}

describe('Core: Developer Mode', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    await sleep(1001) // allow the file to get stat-ed once in the original state
  })

  afterAll(async () => {
    await actionhero.stop()
    fs.writeFileSync(originalFile, originalContent)
    await sleep(1001 * 3)
  })

  test('random numbers work initially', async () => {
    let {error, randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(error).toBeUndefined()
    expect(randomNumber).to.be.at.most(1)
    expect(randomNumber).to.be.at.least(0)
  })

  describe('with new file', () => {
    beforeAll(() => {
      fs.writeFileSync(originalFile, newFileContent)
    })

    test('I can change the file and new actions will be loaded up', async () => {
      await sleep(3001) // file read timer is 1 second; time to notice the change + 3x time to reload API
      expect(api.actions.actions.randomNumber['1'].description).toEqual('HACK')
      let {randomNumber} = await api.specHelper.runAction('randomNumber')
      expect(randomNumber).toEqual('not a number!')
    }).timeout(10000)
  })

  describe('reseting', () => {
    test('can be placed back', async () => {
      fs.writeFileSync(originalFile, originalContent)
      await sleep(5001)
      expect(api.actions.actions.randomNumber['1'].description).toEqual('I am an API method which will generate a random number')
    }).timeout(10000)

    test('works as it did originally', async () => {
      let {error, randomNumber} = await api.specHelper.runAction('randomNumber')
      expect(error).toBeUndefined()
      expect(randomNumber).to.be.at.most(1)
      expect(randomNumber).to.be.at.least(0)
    })
  })
})
