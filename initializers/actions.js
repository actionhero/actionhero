var fs = require('fs');

var actions = function(api, next){
  api.actions = new(require('./common/commonLoader.js'))(api);
  api.actions.actions = {};
  api.actions.versions = {};

  api.actions.preProcessors = [];
  api.actions.postProcessors = [];

  if(api.config.general.simultaneousActions == null){
    api.config.general.simultaneousActions = 5;
  }

  api.actions.validate = function(action){
    var fail = function(msg){
      api.log(msg + '; exiting.', 'emerg');
    }

    if(typeof action.name != 'string' || action.name.length < 1){
      fail('an action is missing \'action.name\'');
      return false;
    } else if(typeof action.description != 'string' || action.description.length < 1){
      fail('Action ' + action.name + ' is missing \'action.description\'');
      return false;
    } else if(typeof action.inputs != 'object'){
      fail('Action ' + action.name + ' has no inputs');
      return false;
    } else if(typeof action.inputs.required != 'object'){
      fail('Action ' + action.name + ' has no required inputs');
      return false;
    } else if(typeof action.inputs.optional != 'object'){
      fail('Action ' + action.name + ' has no optional inputs');
      return false;
    } else if(typeof action.outputExample != 'object'){
      fail('Action ' + action.name + ' has no outputExample');
      return false;
    } else if(typeof action.run != 'function'){
      fail('Action ' + action.name + ' has no run method');
      return false;
    } else if(api.connections != null && api.connections.allowedVerbs.indexOf(action.name) >= 0){
      fail(action.name + ' is a reserved verb for connections. choose a new name');
      return false;
    } else {
      return true;
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
        this.validate(api.actions.actions[action.name][action.version], this.vmap);
        api.log('', 'debug');
  };    

  api.actions.initialize(api.config.general.paths.action);
  next();
  
}

/////////////////////////////////////////////////////////////////////
// exports
exports.actions = actions;
