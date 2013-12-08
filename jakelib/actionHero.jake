// A collection of helpful JAKE scripts for actionHero. 
// You can create your own jake scripts in your project's Jakefile.js
// More information about Jake can be found at https://github.com/mde/jake/

var fs = require('fs');
var path = require('path');

/////////////
// HELPERS //
/////////////

var file_exists = function(file){
  try {
    var stats = fs.lstatSync(file);
    if(stats.isFile() || stats.isSymbolicLink()){ return true }
    else { return false }
  } catch(e){ return false }
}

var api = function(){
  return jake.Task['actionHero:environment'].value;
}

var exitWithError = function(error){
  if(error != null){
    console.log('Error: ' + String(error));
    process.exit();
  }
}

///////////
// TASKS //
///////////

namespace('actionHero', function(){
  desc('I will load and init an actionHero environment');
  task('environment', {async: true}, function() {
    if(file_exists(__dirname + '/../actionHero.js')){
      // in the actionHero project itself
      var actionHero_root = __dirname + '/..';
    } else if(file_exists(__dirname + '/../node_modules/actionHero/actionHero.js')){
      // running from a project's node_modules (bin or actionHero)
      var actionHero_root = __dirname + '/../node_modules/actionHero';
    } else {
      // installed globally
      var actionHero_root = path.normalize(__dirname + '/..');
    }
    var actionHeroPrototype = require(actionHero_root + '/actionHero.js').actionHeroPrototype;
    var actionHero = new actionHeroPrototype();

    var configChanges = {
      logger: {
        transports: null
      }
    }
    actionHero.initialize({configChanges: configChanges}, function(err, api){
      complete(api);
    });
  });
});

namespace('actionHero', function(){
  namespace('actions', function(){

    desc('List your actions and metadata');
    task('list', ['actionHero:environment'], {async: true}, function(){
      for(var collection in api().actions.actions){
        console.log(collection)
        for(var version in api().actions.actions[collection]){
          var action = api().actions.actions[collection][version];
          console.log('  ' + 'version: ' + version);
          console.log('    ' + action.description);
          console.log('    ' + 'required inputs: ' + action.inputs.required.join(', '));
          console.log('    ' + 'optional inputs: ' + action.inputs.optional.join(', '));
        }
      }
      complete(process.exit());
    });

  });
});

namespace('actionHero', function(){
  namespace('tasks', function(){

    desc('This will enqueue all periodic tasks (could lead to duplicates)');
    task('enqueueAllPeriodicTasks', ['actionHero:environment'], {async: true}, function(){
      api().resque.startQueue(function(){
        api().tasks.enqueueAllRecurrentJobs(function(loadedTasks){
          console.log('loaded tasks: ' + loadedTasks.join(', '));
          complete(process.exit());
        });
      });
    });

    desc('This will enqueue a periodic task');
    task('enqueuePeriodicTask', ['actionHero:environment'], {async: true}, function(taskName){
      var task = api().tasks.tasks[taskName];
      api().resque.startQueue(function(){
        api().tasks.enqueue(taskName, function(error){ // enqueue to run ASAP
          console.log('loaded task: ' + taskName);
          complete(process.exit());
        });
      });
    });

    desc('This will remove an enqueued periodic task');
    task('stopPeriodicTask', ['actionHero:environment'], {async: true}, function(taskName){
      var task = api().tasks.tasks[taskName];
      api().resque.startQueue(function(){
        api().tasks.stopRecurrentJob(taskName, function(error, count){
          console.log('removed ' + count + ' instances of ' + taskName);
          complete(process.exit());
        });
      });
    });
  });
});

namespace('actionHero', function(){
  namespace('redis', function(){

    desc('This will clear the entire actionHero redis database');
    task('flush', ['actionHero:environment'], {async: true}, function(){
      api().redis.client.flushdb(function(error, data){
        exitWithError(error);
        console.log('flushed')
        complete(process.exit());
      });
    });

  });
});

namespace('actionHero', function(){
  namespace('cache', function(){

    desc('This will clear actionHero\'s cache');
    task('clear', ['actionHero:environment'], {async: true}, function(){
      api().cache.size(function(error, count){
        exitWithError(error);
        api().redis.client.del(api().cache.redisCacheKey, function(error){
          exitWithError(error);
          console.log('cleared ' + count + ' items from the cache');
          complete(process.exit());
        });
      });
    });

    desc('This will save the current cache as a JSON object');
    task('dump', ['actionHero:environment'], {async: true}, function(file){
      if(file == null){ file = 'cache.dump' }
      api().cache.size(function(error, count){
        exitWithError(error);
        api().redis.client.hgetall(api().cache.redisCacheKey, function(error, data){
          exitWithError(error);
          fs.writeFileSync(file, JSON.stringify(data));
          console.log('dumped ' + count + ' items from the cache');
          complete(process.exit());
        });
      });
    });

    desc('This will load (and overwrite) the cache from a file');
    task('load', ['actionHero:environment'], {async: true}, function(file){
      if(file == null){ file = 'cache.dump' }
      var data = JSON.parse( fs.readFileSync(file) );
      api().redis.client.hmset(api().cache.redisCacheKey, data, function(error, data){
        exitWithError(error);
        api().cache.size(function(error, count){
          exitWithError(error);
          console.log('loaded ' + count + ' items into the cache');
          complete(process.exit());
        });
      });
    });

  });
});
