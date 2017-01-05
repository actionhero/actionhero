'use strict';

// use me to exclude the files from a plugin within this project
const path     = require('path');
const fs       = require('fs');
const optimist = require('optimist');
const argv = optimist
  .demand('name')
  .describe('name', 'The name of the plugin')
  .argv;

module.exports = function(api, next){
  const linkRelativeBase = api.projectRoot + path.sep;
  let pluginRoot;

  api.config.general.paths.plugin.forEach(function(pluginPath){
    const pluginPathAttempt = path.normalize(pluginPath + path.sep + argv.name);
    if(!pluginRoot && api.utils.dirExists(pluginPath + path.sep + argv.name)){
      pluginRoot = pluginPathAttempt;
    }
  });

  if(!pluginRoot){
    api.log(['plugin `%s` not found in plugin paths', argv.name], 'warning', api.config.general.paths.plugin);
    return next(null, true);
  }

  const pluginRootRelative = pluginRoot.replace(linkRelativeBase, '');
  api.log(['unlinking the plugin found at %s', pluginRootRelative]);

  // unlink actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    const localLinkDirectory = path.normalize(api.config.general.paths[c[0]][0] + path.sep + 'plugins');
    const localLinkLocation  = path.normalize(localLinkDirectory + path.sep + argv.name + '.link');

    if(api.utils.dirExists(localLinkDirectory)){
      api.utils.removeLinkfileSafely(localLinkLocation);
    }
  });

  api.log('Remember that config files have to be deleted manually', 'warning');
  api.log('If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with "npm uninstall --save"', 'warning');
  next(null, true);
};
