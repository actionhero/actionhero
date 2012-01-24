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
		
		connection.response.clusterCacheTest = {};
		connection.response.nodeDuplication = api.configData.actionCluster.nodeDuplication;
		
		api.actionCluster.cache.save(api, key, value, null, function(saveResp){
			connection.response.clusterCacheTest.saveTest = saveResp
			api.actionCluster.cache.load(api, key, function(loadResp){
				connection.response.clusterCacheTest.loadTest = loadResp;
				api.actionCluster.cache.destroy(api, key, function(destroyResp){
					connection.response.clusterCacheTest.destroyTest = destroyResp;
					api.actionCluster.cache.save(api, key, value, null, null);
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