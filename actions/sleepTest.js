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

  run: function(api, connection, next){
    var sleepDuration = connection.params.sleepDuration;

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