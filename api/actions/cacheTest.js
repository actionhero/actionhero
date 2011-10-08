function cacheTest(api, next)
{
	api.utils.requiredParamChecker(api, ["key","value"]);
	if(api.error == false)
	{
		key = api.params.key;
		value = api.params.value;
		
		api.response = {cacheTestResults : {
			"key" : key,
			"value" : value,
		}};
		
		api.cache.save(api,key,value,null, function(resp){
			api.response.cacheTestResults.saveResp = resp;
			api.cache.load(api,key, function(resp){
				api.response.cacheTestResults.loadResp = resp;
				api.cache.destroy(api,key, function(resp){
					api.response.cacheTestResults.deleteResp = resp;
					next();
				});
			});
		});

	}
	else
	{
		next();
	}
};

exports.cacheTest = cacheTest;