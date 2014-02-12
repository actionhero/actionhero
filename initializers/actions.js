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
      'inputs':function(action){
        if(typeof action.inputs != 'object'){
          return false;
        } else if(typeof action.inputs.required != 'object'){
          return false;
        } else if(typeof action.inputs.optional != 'object'){
          return false;    
        } else {
          return true;
        }
      }, 
      'outputExample':'object',
      'connections' : function(action){
        if(api.connections != null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
          api.log(action.name + ' is a reserved verb for connections. choose a new name');
          return false;
        } else {
          return true;
        }
      },
      'run':'function'
    };
  
  api.actions.validate = function(action){
    api.actions._validate(action, api.actions.vmap);
  
  };
 
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
   
        this.validate(api.actions.actions[action.name][action.version]);
     
  };    
  
  api.actions.initialize(api.config.general.paths.action);
  next();
  
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;
