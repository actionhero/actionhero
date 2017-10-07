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

    // CLI commands included with ActionHero
    if (api.config.general.cliIncludeInternal !== false) {
      glob.sync(path.join(api.actionheroRoot, 'bin', 'methods', '**', '*.js')).forEach((f) => { files.push(f) })
    }

    // CLI commands included in this project
    api.config.general.paths.cli.forEach((cliPath) => {
      glob.sync(path.join(cliPath, '**', '*.js')).forEach((f) => { files.push(f) })
    })

    // CLI commands from plugins
    Object.keys(api.config.plugins).forEach((pluginName) => {
      let plugin = api.config.plugins[pluginName]
      if (plugin.cli !== false) {
        glob.sync(path.join(plugin.path, 'bin', '**', '*.js')).forEach((f) => { files.push(f) })
      }
    })

    files = api.utils.arrayUniqueify(files)

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

    console.log('ActionHero - The reusable, scalable, and quick node.js API server for stateless and stateful applications')
    console.log('Learn more @ www.actionherojs.com')
    console.log('')
    console.log('CLI Commands:\r\n')
    methodNames.forEach((methodName) => {
      console.log(`* ${methodName}`)
    })

    methodNames.forEach((methodName) => {
      let m = methods[methodName]
      this.highlightWord(`actionhero ${m.name}`)
      console.log(`description: ${m.description}`)

      if (m.example) {
        console.log(`example: ${m.example}`)
      }

      if (!m.inputs) { m.inputs = {} }
      if (Object.keys(m.inputs).length > 0) {
        console.log(`inputs:`)
        Object.keys(m.inputs).forEach((inputName) => {
          let i = m.inputs[inputName]
          console.log(`  [${inputName}] ${(i.required ? '' : '(optional)')}`)
          if (i.note) { console.log(`    note: ${i.note}`) }
          if (i.default) { console.log(`    default: ${i.default}`) }
        })
      }
    })

    console.log('')

    return true
  }

  highlightWord (word) {
    let lines
    console.log('\r\n')
    lines = ''
    for (let i = 0; i < word.length; i++) { lines += '₋' }
    console.log(lines)
    console.log(word)
    lines = ''
    for (let i = 0; i < word.length; i++) { lines += '⁻' }
    console.log(lines)
  }
}
