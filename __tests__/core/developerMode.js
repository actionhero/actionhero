'use strict'

const fs = require('fs')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

require = require.requireActual // eslint-disable-line

const file = path.join(__dirname, '..', '..', 'actions', 'randomNumber.js')
const originalContent = fs.readFileSync(file)

// let newFileContent = ''
// newFileContent += 'const ActionHero = require(\'./../index.js\')\n'
// newFileContent += 'module.exports = class RandomNumber extends ActionHero.Action {\n'
// newFileContent += '  constructor () {\n'
// newFileContent += '    super()\n'
// newFileContent += '    this.name = \'randomNumber\'\n'
// newFileContent += '    this.description = \'HACK\'\n'
// newFileContent += '  }\n'
// newFileContent += '  async run (data) {\n'
// newFileContent += '    data.response.randomNumber = "not a number!"\n'
// newFileContent += '  }\n'
// newFileContent += '}\n'

async function sleep (time) {
  await new Promise((resolve) => { setTimeout(resolve, time) })
}

describe('Core', () => {
  describe('developerMode', () => {
    beforeAll(async () => {
      api = await actionhero.start()
      await sleep(1001 * 3) // allow the file to get stat-ed once in the original state
    })

    afterAll(async () => {
      await actionhero.stop()
      fs.writeFileSync(file, originalContent)
      await sleep(1001 * 3)
    })

    test('random numbers work initially', async () => {
      let {error, randomNumber} = await api.specHelper.runAction('randomNumber')
      expect(error).toBeUndefined()
      expect(randomNumber).toBeLessThanOrEqual(1)
      expect(randomNumber).toBeGreaterThanOrEqual(0)
    })

    // TODO: Jest doesn't allow us to run require again in tests... even if we clear the require cache
    //
    // describe('with new file', () => {
    //   beforeAll(async () => {
    //     fs.writeFileSync(file, newFileContent)
    //     await sleep(1001 * 3) // file read timer is 1 second; time to notice the change + 3x time to reload API
    //   })
    //
    //   test('I can change the file and new actions will be loaded up', async () => {
    //     expect(api.actions.actions.randomNumber['1'].description).toEqual('HACK')
    //     let {randomNumber} = await api.specHelper.runAction('randomNumber')
    //     expect(randomNumber).toEqual('not a number!')
    //   }, 10000)
    // })

    describe('reseting', () => {
      test('can be placed back', async () => {
        fs.writeFileSync(file, originalContent)
        await sleep(1001 * 3)
        expect(api.actions.actions.randomNumber['1'].description).toEqual('I am an API method which will generate a random number')
      }, 10000)

      test('works as it did originally', async () => {
        let {error, randomNumber} = await api.specHelper.runAction('randomNumber')
        expect(error).toBeUndefined()
        expect(randomNumber).toBeLessThanOrEqual(1)
        expect(randomNumber).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
