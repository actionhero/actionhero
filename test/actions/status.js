'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionheroPrototype = require(path.join(__dirname, '/../../actionhero.js'))
const actionhero = new ActionheroPrototype()
let api

describe('Action: status', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  it('returns node status', async () => {
    let {id, problems} = await api.specHelper.runAction('status')
    expect(problems).to.have.length(0)
    expect(id).to.equal('test-server-' + process.pid)
  })
})
