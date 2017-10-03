'use strict'

const glob = require('glob')
const path = require('path')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Help extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'help'
    this.description = 'get actonhero CLI help; will display this document'
  }

  run () {
    let files = []
    let methods = {}

    glob.sync(path.join(api.actionheroRoot, 'bin', 'methods', '**', '*.js')).forEach((f) => { files.push(f) })
    glob.sync(path.join(api.projectRoot + 'bin', '**', '*.js')).forEach((f) => { files.push(f) })

    files.forEach((f) => {
      try {
        let ReqClass = require(f)
        let req = new ReqClass()
        if (req.name && req.name !== '%%name%%' && req.description && typeof req.run === 'function') {
          if (methods[req.name]) { throw new Error(`${req.name} is already defined`) }
          methods[req.name] = req
        }
      } catch (e) { }
    })

    let methodNames = Object.keys(methods).sort()

    console.log('ActionHero - A multi-transport node.js API Server with integrated cluster capabilities and delayed tasks\r\n')
    console.log('Binary options:\r\n')
    methodNames.forEach((methodName) => {
      console.log(`* ${methodName}`)
    })

    console.log('\r\nDescriptions:')
    methodNames.forEach((methodName) => {
      let m = methods[methodName]
      console.log(`\r\n* ${m.name}`)
      console.log(`  description: ${m.description}`)

      if (m.example) {
        console.log(`  example: ${m.example}`)
      }

      if (!m.inputs) { m.inputs = {} }
      if (Object.keys(m.inputs).length > 0) {
        console.log(`  inputs:`)
        Object.keys(m.inputs).forEach((inputName) => {
          let i = m.inputs[inputName]
          console.log(`    [${inputName}] ${(i.required ? '' : '(optional)')}`)
          if (i.note) { console.log(`      note: ${i.note}`) }
          if (i.default) { console.log(`      default: ${i.default}`) }
        })
      }
    })

    return true
  }
}
