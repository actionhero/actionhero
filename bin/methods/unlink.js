'use strict'

const path = require('path')
const ActionHero = require('./../../index.js')
const api = ActionHero.api

module.exports = class Unlink extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'unlink'
    this.description = 'unlink a plugin from this actionhero project'
    this.example = 'actionhero unlink --name=[pluginName]'
    this.inputs = {
      name: {required: true}
    }
  }

  run ({params}) {
    const linkRelativeBase = api.projectRoot + path.sep
    let pluginRoot

    api.config.general.paths.plugin.forEach((pluginPath) => {
      const pluginPathAttempt = path.normalize(pluginPath + path.sep + params.name)
      if (!pluginRoot && api.utils.dirExists(pluginPath + path.sep + params.name)) {
        pluginRoot = pluginPathAttempt
      }
    })

    if (!pluginRoot) {
      throw new Error(`plugin \`${params.name}\` not found in plugin paths: ${api.config.general.paths.plugin}`)
    }

    const pluginRootRelative = pluginRoot.replace(linkRelativeBase, '')
    console.log(`unlinking the plugin found at ${pluginRootRelative}`);

    // unlink actionable files
    [
      ['action', 'actions'],
      ['task', 'tasks'],
      ['public', 'public'],
      ['server', 'servers'],
      ['initializer', 'initializers']
    ].forEach((c) => {
      const localLinkDirectory = path.normalize(api.config.general.paths[c[0]][0] + path.sep + 'plugins')
      const localLinkLocation = path.normalize(localLinkDirectory + path.sep + params.name + '.link')

      if (api.utils.dirExists(localLinkDirectory)) {
        console.log(api.utils.removeLinkfileSafely(localLinkLocation))
      }
    })

    console.log('Remember that config files have to be deleted manually')
    console.info('If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with "npm uninstall --save"')
    return true
  }
}
