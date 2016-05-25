'use strict';

// use me to exclude the files from a plugin within this project
var path = require('path');
var fs   = require('fs');

exports.unlink = function(binary, next){
  if(!binary.argv.name){ binary.utils.hardError('name (of the plugin to link) is a required input'); }
  if(!binary.argv.linkRelativeBase){ binary.argv.linkRelativeBase = binary.projectRoot + path.sep; }

  var pluginRoot;
  binary.config.general.paths.plugin.forEach(function(pluginPath){
    var pluginPathAttempt = path.normalize(pluginPath + path.sep + binary.argv.name);
    if(!pluginRoot && binary.utils.dirExists(pluginPath + path.sep + binary.argv.name)){
      pluginRoot = pluginPathAttempt;
    }
  });

  if(!pluginRoot){
    binary.log('plugin `' + binary.argv.name + '` not found in plugin paths', 'warning', binary.config.general.paths.plugin);
    return next(true);
  }

  var pluginRootRelative = pluginRoot.replace(binary.argv.linkRelativeBase, '');
  binary.log('unlinking the plugin found at ' + pluginRootRelative);

  // unlink actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    var localLinkDirectory = binary.config.general.paths[c[0]][0] + path.sep + 'plugins';
    var localLinkLocation  = localLinkDirectory + path.sep + binary.argv.name + '.link';

    if(binary.utils.dirExists(localLinkDirectory)){
      binary.utils.removeLinkfileSafely(localLinkLocation);
    }
  });
  binary.log('Remember that config files have to be deleted manually');
  binary.log('If your plugin was installed via NPM, also be sure to remove it from your package.json or uninstall it with "npm uninstall --save"');
  next(true);
};
