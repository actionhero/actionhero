module.exports = {
  loadPriority:  410,
  initialize: function(api, next){
    
    api.actions = {};
    api.actions.actions = {};
    api.actions.versions = {};

    api.actions.preProcessors = {};
    api.actions.postProcessors = {};

    api.actions.addPreProcessor = function(func, priority) {
      if(!priority) priority = api.config.general.defaultMiddlewarePriority;
      priority = Number(priority); // ensure priority is numeric
      if(!api.actions.preProcessors[priority]) api.actions.preProcessors[priority] = [];
      return api.actions.preProcessors[priority].push(func);
    }
    api.actions.addPostProcessor = function(func, priority) {
      if(!priority) priority = api.config.general.defaultMiddlewarePriority;
      priority = Number(priority); // ensure priority is numeric
      if(!api.actions.postProcessors[priority]) api.actions.postProcessors[priority] = [];
      return api.actions.postProcessors[priority].push(func);
    }
    
    api.actions.validateAction = function(action){
      var fail = function(msg){
        api.log(msg + '; exiting.', 'emerg');
        process.exit();
      }

      if(action.inputs === undefined){
        action.inputs = {};
      }

      if(typeof action.name !== 'string' || action.name.length < 1){
        fail('an action is missing \'action.name\'');
        return false;
      } else if(typeof action.description !== 'string' || action.description.length < 1){
        fail('Action ' + action.name + ' is missing \'action.description\'');
        return false;
      } else if(typeof action.run !== 'function'){
        fail('Action ' + action.name + ' has no run method');
        return false;
      } else if(api.connections !== null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
        fail(action.name + ' is a reserved verb for connections. choose a new name');
        return false;
      } else {
        return true;
      }
    }

    api.actions.loadFile = function(fullFilePath, reload){
      if(reload === null){ reload = false; }

      var loadMessage = function(action){
        var msgString = '';
        if(reload){
          msgString = 'action (re)loaded: ' + action.name + ' @ v' + action.version + ', ' + fullFilePath;
        } else {
          msgString = 'action loaded: ' + action.name + ' @ v' + action.version + ', ' + fullFilePath;
        }
        api.log(msgString, 'debug');
      }

      api.watchFileAndAct(fullFilePath, function(){
        api.actions.loadFile(fullFilePath, true);
        api.params.buildPostVariables();
        api.routes.loadRoutes();
      })

      try {
        var collection = require(fullFilePath);
        for(var i in collection){
          var action = collection[i];
          if(action.version === null || action.version === undefined){ action.version = 1.0 }
          if(api.actions.actions[action.name] === null || api.actions.actions[action.name] === undefined){ 
            api.actions.actions[action.name] = {} 
          }
          api.actions.actions[action.name][action.version] = action;
          if(api.actions.versions[action.name] === null || api.actions.versions[action.name] === undefined){
            api.actions.versions[action.name] = [];
          }
          api.actions.versions[action.name].push(action.version);
          api.actions.versions[action.name].sort();
          api.actions.validateAction(api.actions.actions[action.name][action.version]);
          loadMessage(action);
        }
      } catch(err){
        try {
          api.exceptionHandlers.loader(fullFilePath, err);
          delete api.actions.actions[action.name][action.version];  
        } catch(err2) {
          throw err;
        }
        
      }
    }

    api.config.general.paths.action.forEach(function(p){
      api.utils.recursiveDirectoryGlob(p).forEach(function(f){
        api.actions.loadFile(f);
      });
    })

    next();
  }
}