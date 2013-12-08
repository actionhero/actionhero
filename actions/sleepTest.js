var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = 'sleepTest';
action.description = 'I will sleep and then return';
action.inputs = {
  'required' : [],
  'optional' : ['sleepDuration']
};
action.blockedConnectionTypes = [];
action.outputExample = {
  sleepStarted: 1234,
  sleepEnded: 1234,
  sleepDuration: 0,
  sleepDelta: 0
}

/////////////////////////////////////////////////////////////////////
// functional

var isNumber = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

action.run = function(api, connection, next){
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
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
