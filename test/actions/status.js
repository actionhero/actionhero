'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../index.js'))
const actionhero = new ActionHero.Process()
let api

describe('Action: status', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('returns node status', async () => {
    let {id, problems, name, error} = await api.specHelper.runAction('status')
    expect(error).to.not.exist()
    expect(problems).to.have.length(0)
    expect(id).to.equal('test-server-' + process.pid)
    expect(name).to.equal('actionhero')
  })
})
