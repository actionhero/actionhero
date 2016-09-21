'use strict';

const fs = require('fs');
const optimist = require('optimist');
const argv = optimist
  .demand('name')
  .demand('queue')
  .describe('name', 'The name of athe task')
  .describe('description', 'The description of the task')
  .describe('queue', 'The default queue for this task')
  .describe('frequency', 'is this task periodic, and if so, how often should it run?')
  .default('description', 'My Task')
  .default('frequency', 0)
  .argv;

module.exports = function(api, next){

  let data = fs.readFileSync(__dirname + '/../../templates/task.js');
  data = String(data);

  [
    'name',
    'description',
    'queue',
    'frequency',
  ].forEach(function(v){
    let regex = new RegExp('%%' + v + '%%', 'g');
    data = data.replace(regex, argv[v]);
  });

  api.utils.createFileSafely(api.config.general.paths.task[0] + '/' + argv.name + '.js', data);

  next(null, true);
};
