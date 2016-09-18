'use strict';

// use me to exclude the files from a plugin within this project
var path     = require('path');
var fs       = require('fs');
var optimist = require('optimist');
var argv = optimist
  .demand('name')
  .describe('name', 'The name of the plugin')
  .argv;

module.exports = function(api, next){
  var linkRelativeBase = api.projectRoot + path.sep;
  var pluginRoot;

  api.config.general.paths.plugin.forEach(function(pluginPath){
    var pluginPathAttempt = path.normalize(pluginPath + path.sep + argv.name);
    if(!pluginRoot && api.utils.dirExists(pluginPath + path.sep + argv.name)){
      pluginRoot = pluginPathAttempt;
    }
  });

  if(!pluginRoot){
    api.log('plugin `' + argv.name + '` not found in plugin paths', 'warning', api.config.general.paths.plugin);
    return next(null, true);
  }

  var pluginRootRelative = pluginRoot.replace(linkRelativeBase, '');
  api.log('unlinking the plugin found at ' + pluginRootRelative);

  // unlink actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    var localLinkDirectory = path.normalize(api.config.general.paths[c[0]][0] + path.sep + 'plugins');
    var localLinkLocation  = path.normalize(localLinkDirectory + path.sep + argv.name + '.link');

    if(api.utils.dirExists(localLinkDirectory)){
      api.utils.removeLinkfileSafely(localLinkLocation);
    }
  });

  api.log('Remember that config files have to be deleted manually', 'warning');
  api.log('If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with "npm uninstall --save"', 'warning');
  next(null, true);
};
