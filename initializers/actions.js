var fs = require('fs');

var actions = function(api, next){
  api.actions = new api.commonLoader;
  api.actions.actions = {};
  api.actions.versions = {};

  api.actions.preProcessors = [];
  api.actions.postProcessors = [];

  if(api.config.general.simultaneousActions == null){
    api.config.general.simultaneousActions = 5;
  }
  api.actions.vmap = {
      'name':'string',
      'description':'string', 
      'inputs':'object', 
      'outputExample':'object', 
      'run':'function' 
    };
  api.actions.validate = function(action, map){
    var fail = function(msg){
      api.log(msg + '; exiting.', 'emerg');
    }

    if(typeof action.inputs != 'object'){
      fail('Action ' + action.name + ' has no inputs');
      return false;
    } else if(typeof action.inputs.required != 'object'){
      fail('Action ' + action.name + ' has no required inputs');
      return false;
    } else if(typeof action.inputs.optional != 'object'){
      fail('Action ' + action.name + ' has no optional inputs');
      return false;    
    } else if(api.connections != null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
      fail(action.name + ' is a reserved verb for connections. choose a new name');
      return false;
    } else {
      this._validate(action, map);
    }
    
  }

  api.actions.exceptionManager = function(fullFilePath, err, action){
    api.exceptionHandlers.loader(fullFilePath, err);
    delete api.actions.actions[action.name][action.version];
  };
  
  api.actions.fileHandler = function(action, reload){
  var self = this;
   if(action.version == null){ action.version = 1.0 }
        if(this.actions[action.name] == null){ api.actions.actions[action.name] = {} }
        this.actions[action.name][action.version] = action;
        if(this.versions[action.name] == null){
          this.versions[action.name] = [];
        }
        this.versions[action.name].push(action.version);
        this.versions[action.name].sort();
        api.log(this.vmap);
        this.validate(api.actions.actions[action.name][action.version], this.vmap);
        api.log('', 'debug');
  };    
  
  api.actions.initialize(api.config.general.paths.action);
  next();
  
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;
