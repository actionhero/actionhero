'use strict';

const fs = require('fs');
const optimist = require('optimist');
const argv = optimist
  .demand('name')
  .describe('name', 'The name of the action')
  .describe('description', 'The description of the action')
  .default('description', 'My Action')
  .argv;

module.exports = function(api, next){

  let data = fs.readFileSync(__dirname + '/../../templates/action.js');
  data = String(data);

  [
    'name',
    'description',
  ].forEach(function(v){
    let regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, argv[v]);
  });

  api.utils.createFileSafely(api.config.general.paths.action[0] + '/' + argv.name + '.js', data);

  next(null, true);
};
