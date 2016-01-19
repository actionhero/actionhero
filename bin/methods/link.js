// use me to include the files from a plugin within this project
var path = require('path');
var fs   = require('fs');

exports.link = function(binary, next){
  if(!binary.argv.name){ binary.utils.hardError('name (of the plugin to link) is a required input'); }

  var pluginRoot;
  binary.config.general.paths.plugin.forEach(function(pluginPath){
    var pluginPathAttempt = path.normalize(pluginPath + '/' + binary.argv.name);
    if( !pluginRoot && binary.utils.dirExists(pluginPath + '/' + binary.argv.name) ){
      pluginRoot = pluginPathAttempt;
    }
  });

  if(!pluginRoot){
    binary.log('plugin `' + binary.argv.name + '` not found in plugin paths', 'warning', binary.config.general.paths.plugin);
    return next(true);
  }

  var pluginRootRelative = pluginRoot.replace(binary.projectRoot + path.sep, '');
  binary.log('linking the plugin found at ' + pluginRootRelative);

  // link actionable files
  [
    [ 'action',      'actions'      ],
    [ 'task',        'tasks'        ],
    [ 'public',      'public'       ],
    [ 'server',      'servers'      ],
    [ 'initializer', 'initializers' ],
  ].forEach(function(c){
    var localLinkLocation  = binary.config.general.paths[c[0]][0] + path.sep + binary.argv.name;
    var pluginSubSection   = pluginRootRelative + path.sep + c[1];
    var link               = path.relative(binary.config.general.paths[c[0]][0], pluginSubSection);

    if( binary.utils.dirExists(pluginSubSection) ){
      binary.utils.createSymlinkSafely(localLinkLocation, link);
    }
  })

  // copy config files
  var pluginConfigDir = pluginRoot + path.sep + 'config';
  if( binary.utils.dirExists(pluginConfigDir) ){
    fs.readdirSync(pluginConfigDir).forEach(function(pluginConfigFile){
      var content = fs.readFileSync(pluginConfigDir + path.sep + pluginConfigFile);
      var fileParts = pluginConfigFile.split(path.sep)
      var localConfigFile = binary.projectRoot + path.sep + 'config' + path.sep + fileParts[(fileParts.length - 1)];
      if(process.env.ACTIONHERO_CONFIG){
        localConfigFile = process.env.ACTIONHERO_CONFIG + path.sep + fileParts[(fileParts.length - 1)];
      }
      binary.utils.createFileSafely(localConfigFile, content);
    });
  }

  next(true);
};
