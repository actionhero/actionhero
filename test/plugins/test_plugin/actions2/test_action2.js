var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = 'test_action2';
action.description = 'I\'m just for testing';
action.inputs = {
  'required' : [],
  'optional' : []
};
action.blockedConnectionTypes = [];
action.outputExample = {
  test: 'OK'
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  connection.response.test = 'OK';
  next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
