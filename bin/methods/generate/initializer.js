'use strict';

var fs = require('fs');
var optimist = require('optimist');
var argv = optimist
  .demand('name')
  .describe('name', 'The name of the initializer')
  .describe('loadPriority', 'order of operations')
  .describe('startPriority', 'order of operations')
  .describe('stopPriority', 'order of operations')
  .default('loadPriority', 1000)
  .default('startPriority', 1000)
  .default('stopPriority', 1000)
  .argv;

module.exports = function(api, next){

  var data = fs.readFileSync(__dirname + '/../../templates/initializer.js');
  data = String(data);

  [
    'name',
    'loadPriority',
    'startPriority',
    'stopPriority',
  ].forEach(function(v){
    var regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, argv[v]);
  });

  api.utils.createFileSafely(api.config.general.paths.initializer[0] + '/' + argv.name + '.js', data);

  next(null, true);
};
