'use strict'

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action', () => {
  describe('randomNumber', () => {
    beforeAll(async () => { api = await actionhero.start() })
    afterAll(async () => { await actionhero.stop() })

    let firstNumber = null

    test('generates random numbers', async () => {
      const { randomNumber } = await api.specHelper.runAction('randomNumber')
      expect(randomNumber).toBeGreaterThan(0)
      expect(randomNumber).toBeLessThan(1)
      firstNumber = randomNumber
    })

    test('is unique / random', async () => {
      const { randomNumber } = await api.specHelper.runAction('randomNumber')
      expect(randomNumber).toBeGreaterThan(0)
      expect(randomNumber).toBeLessThan(1)
      expect(randomNumber).not.toEqual(firstNumber)
    })
  })
})
