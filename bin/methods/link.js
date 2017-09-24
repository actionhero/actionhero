'use strict'

const path = require('path')
const fs = require('fs')
const ActionHero = require('./../../index.js')

module.exports = class ActionsList extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'link'
    this.description = 'link a plugin to this actionhero project'
    this.example = 'actionhero link --name=[pluginName] --overwriteConfig=[overwriteConfig]'
    this.inputs = {
      name: {required: true},
      overwriteConfig: {required: false}
    }
  }

  run (api, {params}) {
    let linkRelativeBase = api.projectRoot + path.sep
    let pluginRoot
    let overwriteConfig = false

    api.config.general.paths.plugin.forEach((pluginPath) => {
      let pluginPathAttempt = path.normalize(pluginPath + path.sep + params.name)
      if (!pluginRoot && api.utils.dirExists(pluginPath + path.sep + params.name)) {
        pluginRoot = pluginPathAttempt
      }
    })

    if (!pluginRoot) {
      throw new Error(`plugin \`${params.name}\` not found in plugin paths: ${api.config.general.paths.plugin}`)
    }

    let pluginRootRelative = pluginRoot.replace(linkRelativeBase, '')
    console.log(`linking the plugin found at ${pluginRootRelative}`);

    // link actionable files
    [
      ['action', 'actions'],
      ['task', 'tasks'],
      ['public', 'public'],
      ['server', 'servers'],
      ['initializer', 'initializers']
    ].forEach((c) => {
      let localLinkDirectory = api.config.general.paths[c[0]][0] + path.sep + 'plugins'
      let localLinkLocation = path.normalize(localLinkDirectory + path.sep + params.name + '.link')
      let pluginSubSection = path.normalize(pluginRootRelative + path.sep + c[1])

      if (api.utils.dirExists(pluginSubSection)) {
        console.log(api.utils.createDirSafely(localLinkDirectory))
        console.log(api.utils.createLinkfileSafely(localLinkLocation, c[1], pluginSubSection))
      }
    })

    const copyFiles = (dir, prepend) => {
      if (!prepend) { prepend = '' }
      if (api.utils.dirExists(dir)) {
        fs.readdirSync(dir).forEach((pluginConfigFile) => {
          const file = path.normalize(dir + path.sep + pluginConfigFile)
          const stats = fs.lstatSync(file)
          if (stats.isDirectory()) {
            copyFiles(file, (prepend + path.sep + pluginConfigFile + path.sep))
          } else {
            const content = fs.readFileSync(file)
            const fileParts = pluginConfigFile.split(path.sep)
            let localConfigFile = linkRelativeBase + 'config' + path.sep + prepend + fileParts[(fileParts.length - 1)]
            if (process.env.ACTIONHERO_CONFIG) {
              localConfigFile = process.env.ACTIONHERO_CONFIG + path.sep + prepend + fileParts[(fileParts.length - 1)]
            }
            console.log(api.utils.createFileSafely(path.normalize(localConfigFile), content, overwriteConfig))
          }
        })
      }
    }

    // copy config files
    const pluginConfigDir = pluginRoot + path.sep + 'config'
    copyFiles(pluginConfigDir)
    return true
  }
}
