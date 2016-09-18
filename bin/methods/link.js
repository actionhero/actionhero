'use strict';

// use me to include the files from a plugin within this project
var path     = require('path');
var fs       = require('fs');
var optimist = require('optimist');
var argv = optimist
  .demand('name')
  .describe('name', 'The name of the plugin')
  .describe('overwriteConfig', 'Should we overwrite existing config files for this plugin?')
  .default('overwriteConfig', false)
  .argv;

module.exports = function(api, next){
  var linkRelativeBase = api.projectRoot + path.sep;
  var pluginRoot;
  var overwriteConfig = false;

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
  api.log('linking the plugin found at ' + pluginRootRelative);

  // link actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    var localLinkDirectory = api.config.general.paths[c[0]][0] + path.sep + 'plugins';
    var localLinkLocation  = path.normalize(localLinkDirectory + path.sep + argv.name + '.link');
    var pluginSubSection   = path.normalize(pluginRootRelative + path.sep + c[1]);

    if(api.utils.dirExists(pluginSubSection)){
      api.utils.createDirSafely(localLinkDirectory);
      api.utils.createLinkfileSafely(localLinkLocation, c[1], pluginSubSection);
    }
  });

  var copyFiles = function(dir, prepend){
    if(!prepend){ prepend = ''; }
    if(api.utils.dirExists(dir)){
      fs.readdirSync(dir).forEach(function(pluginConfigFile){
        var file = path.normalize(dir + path.sep + pluginConfigFile);
        var stats = fs.lstatSync(file);
        if(stats.isDirectory()){
          copyFiles(file, (prepend + path.sep + pluginConfigFile + path.sep));
        }else{
          var content = fs.readFileSync(file);
          var fileParts = pluginConfigFile.split(path.sep);
          var localConfigFile = linkRelativeBase + 'config' + path.sep + prepend + fileParts[(fileParts.length - 1)];
          if(process.env.ACTIONHERO_CONFIG){
            localConfigFile = process.env.ACTIONHERO_CONFIG + path.sep + prepend + fileParts[(fileParts.length - 1)];
          }
          api.utils.createFileSafely(path.normalize(localConfigFile), content, overwriteConfig);
        }
      });
    }
  };

  // copy config files
  var pluginConfigDir = pluginRoot + path.sep + 'config';
  copyFiles(pluginConfigDir);
  next(null, true);
};
