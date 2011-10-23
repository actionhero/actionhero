function cacheTest(api, connection, next)
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

exports.cacheTest = cacheTest;