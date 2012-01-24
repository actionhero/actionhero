var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "actionClusterCacheTest";
action.description = "I will test the network/ring cache functions of the API";
action.inputs = {
	"required" : ["key", "value"],
	"optional" : []
};
action.outputExample = {
	cacheTestResults: {
		key: "key",
		value: "value",
		saveResp: "OK",
		loadResp: "OK",
		deleteResp: "OK",
	}
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next)
{
	api.utils.requiredParamChecker(api, connection, ["key","value"]);
	if(connection.error == false)
	{
		var key = connection.params.key;
		var value = connection.params.value;
		
		connection.response = {cacheTestResults : {
			"key" : key,
			"value" : value,
		}};
		
		api.actionCluster.cache.save(api, key, value, null, function(resp){
			console.log(resp);
			connection.response.cacheTest = resp
			next(connection, true);
		});

	}
	else
	{
		next(connection, true);
	}
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;