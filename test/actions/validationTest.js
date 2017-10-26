'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: Validator', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('fails with no params', async () => {
    let {error} = await api.specHelper.runAction('validationTest', {})
    expect(error).to.equal('Error: string is a required parameter for this action')
  })

  it('fails with a number', async () => {
    let {error} = await api.specHelper.runAction('validationTest', {string: 87})
    expect(error).to.equal('Error: Input for parameter "string" failed validation!')
  })
})
