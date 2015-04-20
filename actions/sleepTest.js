exports.sleepTest = {
  name: 'sleepTest',
  description: 'I will sleep and then return',

  inputs: {
    sleepDuration: {
      required: true,
      formatter: function(n){ return parseInt(n); },
      default: function(){ return 1000; }
    }
  },

  outputExample: {  
    "sleepStarted":1420953571322,
    "sleepEnded":1420953572327,
    "sleepDelta":1005,
    "sleepDuration":1000,
    "serverInformation":{  
      "serverName":"actionhero API",
      "apiVersion":"0.0.1",
      "requestDuration":1006,
      "currentTime":1420953572327
    }
  },

  run: function(api, data, next){
    var sleepDuration = data.params.sleepDuration;
    var sleepStarted = new Date().getTime();
    
    setTimeout(function(){
      var sleepEnded = new Date().getTime();
      var sleepDelta = sleepEnded - sleepStarted;
      
      data.response.sleepStarted  = sleepStarted;
      data.response.sleepEnded    = sleepEnded;
      data.response.sleepDelta    = sleepDelta;
      data.response.sleepDuration = sleepDuration;
      
      next();
    }, sleepDuration);
  }
};