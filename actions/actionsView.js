var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "actionsView";
action.description = "I will return an array of all the action accessable to uses of this API";
action.inputs = {
	"required" : [],
	"optional" : []
};
action.outputExample = {
	"actions" : [
	{
		"name" : "actionName",
		"description" : "something about the action",
		"inputs" : {
			"required" : ["input 1", "input 2"],
			"optional" : ["input 3", "input 4"]
		},
		"outputExample" : {
			"listOfStuff" : [1,2,3]
		}
	}
	]
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
	connection.response.actions = [];
	for(var i in api.actions){
		connection.response.actions.push({
			name: api.actions[i].name,
			description: api.actions[i].description,
			inputs: api.actions[i].inputs,
			outputExample: api.actions[i].outputExample,
		});
	}
	if(connection.type == "socket"){
		connection.response.actions.push({
			name: "quit",
			description: "I will send your intent to quit to the API.  You will get a goodbye message and then be disconnected",
			inputs: {"required" : [],"optional" : []},
			outputExample: {"status": "Bye!"},
		});
		connection.response.actions.push({
			name: "paramAdd",
			description: "I am used to add a single saved param to your session. IE: `addParam key=value`",
			inputs: {"required" : ['key=value'],"optional" : []},
			outputExample: {"status": "OK"},
		});
		connection.response.actions.push({
			name: "paramDelete",
			description: "I am used to delte a previously saved param from your session. IE: `paramDelete key`",
			inputs: {"required" : ['key'],"optional" : []},
			outputExample: {"status": "OK"},
		});
		connection.response.actions.push({
			name: "paramView",
			description: "I am used to view a previously saved param from your session. IE: `paramView key`",
			inputs: {"required" : ['key'],"optional" : []},
			outputExample: {key: 'value'},
		});
		connection.response.actions.push({
			name: "paramsView",
			description: "I am used to view all previously saved params session. IE: `paramsView`",
			inputs: {"required" : [],"optional" : []},
			outputExample: {key1: 'value1', key2: 'value2'},
		});
		connection.response.actions.push({
			name: "paramsDelete",
			description: "I am used to delete all previously saved params session. IE: `paramsDelete`",
			inputs: {"required" : [],"optional" : []},
			outputExample: {"status": "OK"},
		});
		connection.response.actions.push({
			name: "roomChange",
			description: "I am used to change the room the connection is in and listening to resonses from",
			inputs: {"required" : ['room'],"optional" : []},
			outputExample: {"status": "OK"},
		});
		connection.response.actions.push({
			name: "roomView",
			description: "I am used to view which room I am in",
			inputs: {"required" : [],"optional" : []},
			outputExample: {"status": "OK"},
		});
		connection.response.actions.push({
			name: "say",
			description: "I am used to send a message to all other clients in my room",
			inputs: {"required" : ["say hello world"],"optional" : []},
			outputExample: {"status": "OK"},
		});
	}
	connection.response.actions.sort(function compare(a,b) {
	  if (a.name < b.name)
	     return -1;
	  if (a.name > b.name)
	    return 1;
	  return 0;
	});
	
	next(connection, true);
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;