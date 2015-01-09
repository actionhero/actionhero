var isNumber = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

exports.sleepTest = {
  name: 'sleepTest',
  description: 'I will sleep and then return',
  outputExample: {},

  inputs: {
    required: [],
    optional: ['sleepDuration']
  },

  run: function(api, connection, next){
    var sleepDuration = connection.params.sleepDuration;
    if(!isNumber(sleepDuration)){
      sleepDuration = 1000;
    }else{
      sleepDuration = parseFloat(sleepDuration);
    }

    var sleepStarted = new Date().getTime();
    setTimeout(function(){
      var sleepEnded = new Date().getTime();
      var sleepDelta = sleepEnded - sleepStarted;
      connection.response.sleepStarted = sleepStarted;
      connection.response.sleepEnded = sleepEnded;
      connection.response.sleepDelta = sleepDelta;
      connection.response.sleepDuration = sleepDuration;
      next(connection, true);
    }, sleepDuration);
  }
};