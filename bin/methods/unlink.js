'use strict'

const path = require('path')

module.exports = {
  name: 'unlink',
  description: 'unlink a plugin from this actionhero project',
  example: 'actionhero unlink --name=[pluginName]',

  inputs: {
    name: {required: true}
  },

  run: function (api, data, next) {
    const linkRelativeBase = api.projectRoot + path.sep
    let pluginRoot

    api.config.general.paths.plugin.forEach(function (pluginPath) {
      const pluginPathAttempt = path.normalize(pluginPath + path.sep + data.params.name)
      if (!pluginRoot && api.utils.dirExists(pluginPath + path.sep + data.params.name)) {
        pluginRoot = pluginPathAttempt
      }
    })

    if (!pluginRoot) {
      api.log(`plugin \`${data.params.name}\` not found in plugin paths`, 'warning', api.config.general.paths.plugin)
      return next(null, true)
    }

    const pluginRootRelative = pluginRoot.replace(linkRelativeBase, '')
    api.log(`unlinking the plugin found at ${pluginRootRelative}`);

    // unlink actionable files
    [
      ['action', 'actions'],
      ['task', 'tasks'],
      ['public', 'public'],
      ['server', 'servers'],
      ['initializer', 'initializers']
    ].forEach(function (c) {
      const localLinkDirectory = path.normalize(api.config.general.paths[c[0]][0] + path.sep + 'plugins')
      const localLinkLocation = path.normalize(localLinkDirectory + path.sep + data.params.name + '.link')

      if (api.utils.dirExists(localLinkDirectory)) {
        api.utils.removeLinkfileSafely(localLinkLocation)
      }
    })

    api.log('Remember that config files have to be deleted manually', 'warning')
    api.log('If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with "npm uninstall --save"', 'warning')
    next(null, true)
  }
}
