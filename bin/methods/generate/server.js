'use strict';

var fs = require('fs');
var optimist = require('optimist');
var argv = optimist
  .demand('name')
  .describe('name', 'The name of the initializer')
  .argv;

module.exports = function(api, next){

  var data = fs.readFileSync(__dirname + '/../../templates/server.js');
  data = String(data);

  [
    'name',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, argv[v]);
  });

  api.utils.createFileSafely(api.config.general.paths.server[0] + '/' + argv.name + '.js', data);

  next(null, true);
};
