exports.%%name%% = function(api, next){

  api.%%name%% = {};

  api.%%name%%._start = function(api, next){
    next();
  };

  api.%%name%%._stop =  function(api, next){
    next();
  };

  next();
}