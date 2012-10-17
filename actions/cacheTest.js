"use strict"

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
	var key = "cacheTest_" + connection.params.key;
	var value = connection.params.value;
		
	connection.response.cacheTestResults = {};
		
	api.cache.save(api,key,value,null, function(resp){
		connection.response.cacheTestResults.saveResp = resp;
		api.cache.size(api, function(numberOfCacheObjects){
			connection.response.cacheTestResults.sizeResp = numberOfCacheObjects;
			api.cache.load(api,key, function(resp, expireTimestamp, createdAt, readAt){
				connection.response.cacheTestResults.loadResp = {
					value: resp,
					expireTimestamp: expireTimestamp, 
					createdAt: createdAt,
					readAt: readAt
				};
				api.cache.destroy(api,key, function(resp){
					connection.response.cacheTestResults.deleteResp = resp;
					next(connection, true);
				});
			});
		});
	});
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;