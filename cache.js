var cache = {};

cache.exists = function(api, key, next){
	api.models.cache.count({ where: {key: key} }).on('success', function(num) {
		if(num == 1){ 
			process.nextTick(function() { next(true); });
		}else{ 
			process.nextTick(function() { next(false); });
		}
	});
};

cache.save = function(api,key,value,expireTime,next){
	var ts = Math.round((new Date()).getTime() / 1000);
	console.log(ts);
	var expiry = new Date()
	expiry.setTime((ts + api.configData.defaultExpireTime) * 1000);
	console.log(expiry);
	var defualtExpireTime = api.utils.sqlDateTime(expiry);
	expireTime = expireTime || defualtExpireTime;
	api.cache.exists(api, key, function(exists){
		if(exists)
		{
			api.models.cache.find({ where: {key: key} }).on('success', function(entry) {
				entry.updateAttributes({
				  value: value
				}).on('success', function(){
					process.nextTick(function() { next("updated record"); });
				});
			});
		}
		else
		{
			api.models.cache.build({
				key: key,
				value: value,
				expireTime: expireTime
			}).save().on('success', function() {
				process.nextTick(function() { next("new record"); });
			});
		}
	});
};

cache.load = function(api, key, next){
	api.cache.exists(api, key, function(exists){
		if(exists)
		{
			api.models.cache.find({ where: {key: key} }).on('success', function(entry) {
				process.nextTick(function() { next(entry.value); });
			});
		}
		else
		{
			process.nextTick(function() { next(false); });
		}
	});
};

cache.destroy = function(api, key, next){
	api.cache.exists(api, key, function(exists){
		if(exists)
		{
			api.models.cache.find({ where: {key: key} }).on('success', function(entry) {
				entry.destroy();
				process.nextTick(function() { next(true); });
			});
		}
		else
		{
			process.nextTick(function() { next(false); });
		}
	});
};

exports.cache = cache;