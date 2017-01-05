'use strict';

// use me to include the files from a plugin within this project
const path     = require('path');
const fs       = require('fs');
const optimist = require('optimist');
const argv = optimist
  .demand('name')
  .describe('name', 'The name of the plugin')
  .describe('overwriteConfig', 'Should we overwrite existing config files for this plugin?')
  .default('overwriteConfig', false)
  .argv;

module.exports = function(api, next){
  let linkRelativeBase = api.projectRoot + path.sep;
  let pluginRoot;
  let overwriteConfig = false;

  api.config.general.paths.plugin.forEach(function(pluginPath){
    let pluginPathAttempt = path.normalize(pluginPath + path.sep + argv.name);
    if(!pluginRoot && api.utils.dirExists(pluginPath + path.sep + argv.name)){
      pluginRoot = pluginPathAttempt;
    }
  });

  if(!pluginRoot){
    api.log(['plugin `%s` not found in plugin paths', argv.name], 'warning', api.config.general.paths.plugin);
    return next(null, true);
  }

  let pluginRootRelative = pluginRoot.replace(linkRelativeBase, '');
  api.log(['linking the plugin found at %s', pluginRootRelative]);

  // link actionable files
  [
    ['action', 'actions'],
    ['task', 'tasks'],
    ['public', 'public'],
    ['server', 'servers'],
    ['initializer', 'initializers'],
  ].forEach(function(c){
    let localLinkDirectory = api.config.general.paths[c[0]][0] + path.sep + 'plugins';
    let localLinkLocation  = path.normalize(localLinkDirectory + path.sep + argv.name + '.link');
    let pluginSubSection   = path.normalize(pluginRootRelative + path.sep + c[1]);

    if(api.utils.dirExists(pluginSubSection)){
      api.utils.createDirSafely(localLinkDirectory);
      api.utils.createLinkfileSafely(localLinkLocation, c[1], pluginSubSection);
    }
  });

  const copyFiles = function(dir, prepend){
    if(!prepend){ prepend = ''; }
    if(api.utils.dirExists(dir)){
      fs.readdirSync(dir).forEach(function(pluginConfigFile){
        const file = path.normalize(dir + path.sep + pluginConfigFile);
        const stats = fs.lstatSync(file);
        if(stats.isDirectory()){
          copyFiles(file, (prepend + path.sep + pluginConfigFile + path.sep));
        }else{
          const content = fs.readFileSync(file);
          const fileParts = pluginConfigFile.split(path.sep);
          const localConfigFile = linkRelativeBase + 'config' + path.sep + prepend + fileParts[(fileParts.length - 1)];
          if(process.env.ACTIONHERO_CONFIG){
            localConfigFile = process.env.ACTIONHERO_CONFIG + path.sep + prepend + fileParts[(fileParts.length - 1)];
          }
          api.utils.createFileSafely(path.normalize(localConfigFile), content, overwriteConfig);
        }
      });
    }
  };

  // copy config files
  const pluginConfigDir = pluginRoot + path.sep + 'config';
  copyFiles(pluginConfigDir);
  next(null, true);
};
