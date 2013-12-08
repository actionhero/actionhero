var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = 'randomNumber';
action.description = 'I am an API method which will generate a random number';
action.inputs = {
  'required' : [],
  'optional' : []
};
action.blockedConnectionTypes = [];
action.outputExample = {
  randomNumber: 123
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  connection.response.randomNumber = Math.random();
  next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
