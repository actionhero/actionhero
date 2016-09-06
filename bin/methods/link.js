'use strict';

// use me to include the files from a plugin within this project
var path = require('path');
var fs   = require('fs');

exports.link = function(binary, next){
  if(!binary.argv.name){ binary.utils.hardError('name (of the plugin to link) is a required input'); }

  if(!binary.argv.linkRelativeBase){ binary.argv.linkRelativeBase = binary.projectRoot + path.sep; }

  var pluginRoot;
  var overwriteConfig = false;
  if(binary.argv.overwriteConfig){ overwriteConfig = true; }
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
  binary.log('linking the plugin found at ' + pluginRootRelative);

  // link actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    var localLinkDirectory = binary.config.general.paths[c[0]][0] + path.sep + 'plugins';
    var localLinkLocation  = localLinkDirectory + path.sep + binary.argv.name + '.link';
    var pluginSubSection   = pluginRootRelative + path.sep + c[1];

    if(binary.utils.dirExists(pluginSubSection)){
      binary.utils.createDirSafely(localLinkDirectory);
      binary.utils.createLinkfileSafely(localLinkLocation, c[1], pluginSubSection);
    }
  });

  var copyFiles = function(dir, prepend){
    if(!prepend){ prepend = ''; }
    if(binary.utils.dirExists(dir)){
      fs.readdirSync(dir).forEach(function(pluginConfigFile){
        var file = dir + path.sep + pluginConfigFile;
        var stats = fs.lstatSync(file);
        if(stats.isDirectory()){
          copyFiles(file, (prepend + path.sep + pluginConfigFile + path.sep));
        }else{
          var content = fs.readFileSync(file);
          var fileParts = pluginConfigFile.split(path.sep);
          var localConfigFile = binary.argv.linkRelativeBase + 'config' + path.sep + prepend + fileParts[(fileParts.length - 1)];
          if(process.env.ACTIONHERO_CONFIG){
            localConfigFile = process.env.ACTIONHERO_CONFIG + path.sep + prepend + fileParts[(fileParts.length - 1)];
          }
          binary.utils.createFileSafely(localConfigFile, content, overwriteConfig);
        }
      });
    }  
  };

  // copy config files
  var pluginConfigDir = pluginRoot + path.sep + 'config';
  copyFiles(pluginConfigDir);
  next(true);
};
