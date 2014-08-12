var fs = require('fs')
  , path = require('path')

  
var actionheroRoot = function(){
  var rv
  if(fs.existsSync(__dirname + '/actionhero.js')){
    // in the actionhero project itself
    rv = __dirname
  } else if(fs.existsSync(__dirname + '/../actionhero.js')){
    // running from /grunt in the actionhero project itself
    rv =  __dirname + '/../'
  } else if(fs.existsSync(__dirname + '/node_modules/actionhero/actionhero.js')){
    // running from a project's node_modules (bin or actionhero)
    rv = __dirname + '/node_modules/actionhero'
  } else {
    // installed globally
    rv = path.normalize(__dirname)
  }
  return rv
}




module.exports = function(grunt){
  //load all the other tasks from the tasks directory
  grunt.loadTasks(path.join(__dirname, 'tasks'));
  
  //add `startActionhero` to the grunt object, beucause it's currently not possible to easiely run a task inside another one.
  //we need to start actionhero before every task. This should be changed into a "actionhero:initialize" task as soon as grunt support dependent tasks
  grunt.startActionhero = function(callback, logging){
    var ActionHeroPrototype = require(actionheroRoot() + '/actionhero.js').actionheroPrototype
    var actionhero = new ActionHeroPrototype();
      
    var configChanges = {
      general: {
        developmentMode: false
      }
    };
      
    if(!logging){
      configChanges.logger = {transports: null};
    }
  
    actionhero.initialize({configChanges: configChanges}, function(err, api){
      callback(api, actionhero);
    })
  }
}