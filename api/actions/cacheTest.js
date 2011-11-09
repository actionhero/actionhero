var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "cacheTest";
action.description = "I will test the internal cache functions of the API";
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
		key = connection.params.key;
		value = connection.params.value;
		
		connection.response = {cacheTestResults : {
			"key" : key,
			"value" : value,
		}};
		
		api.cache.save(api,key,value,null, function(resp){
			connection.response.cacheTestResults.saveResp = resp;
			api.cache.load(api,key, function(resp){
				connection.response.cacheTestResults.loadResp = resp;
				api.cache.destroy(api,key, function(resp){
					connection.response.cacheTestResults.deleteResp = resp;
					next(connection, true);
				});
			});
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