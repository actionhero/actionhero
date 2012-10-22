var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "randomNumber";
action.description = "I am an API method which will generate a random number.  Different HTTP verbs will multiply the answer";
action.inputs = {
	"required" : [],
	"optional" : []
};
action.outputExample = {
	randomNumber: 123
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
	if(connection.method == "GET" || connection.method == null){
		connection.response.randomNumber = Math.random();
	}
	else if(connection.method == "PUT"){
		connection.response.randomNumber = Math.random() * 10;
	}
	else if(connection.method == "POST"){
		connection.response.randomNumber = Math.random() * 100;
	}
	else if(connection.method == "DELETE"){
		connection.response.randomNumber = Math.random() * 1000;
	}
	next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;