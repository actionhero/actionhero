exports.%%name%% = function(api, next){

  api.%%name%% = new api.commonLoader;
  api.%%name%%.%%name%% = {};

  api.%%name%%.vmap = {
    'name':'string'
  };

  api.%%name%%.validate = function(%%name%%){
    api.%%name%%._validate(%%name%%, api.%%name%%.vmap);
  };
  
  api.%%name%%.exceptionManager = function(fullFilePath, err, %%name%%){
    api.exceptionHandlers.loader(fullFilePath, err);
    delete api.%%name%%.%%name%%[%%name%%.name];
  };
  
  api.%%name%%.fileHandler = function(%%name%%, reload, fullFilePath){
      
    if(this.%%name%%[%%name%%.name]){   
      api.%%name%%.%%name%%[%%name%%.name]= %%name%%;
    }
    
  };
  
  api.%%name%%._start = function(api, next){
     api.log(api.config.general.paths.%%name%%);
    api.%%name%%.initialize(api.config.general.paths.%%name%%);    
    next();
  };

  api.%%name%%._stop =  function(api, next){
    next();
  };

  next();
}