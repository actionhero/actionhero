var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = 'randomNumber';
action.description = 'I am an API method which will generate a random number';
action.inputs = {
  'required' : [],
  'optional' : ['toAdd'],
  'validate' : {
  	toAdd : 'isInt'
  }
};
action.blockedConnectionTypes = [];
action.outputExample = {
  randomNumber: 123
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
	var toAdd = 0;
  if(typeof(connection.params.toAdd) !== 'undefined'){
  	toAdd = Number(connection.params.toAdd)
  }
  connection.response.randomNumber = Math.random() + toAdd;
  next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
