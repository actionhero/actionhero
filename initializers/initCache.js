////////////////////////////////////////////////////////////////////////////
// cache

var initCache = function(api, next){
	
	api.cache = {};
	
	api.cache.buildSQLExpireString = function(api, secondsFromNow){
		var now = new Date();
		var expireDate = new Date();
		expireDate.setTime(now.getTime() + (secondsFromNow * 1000));
		var expireDateString = api.utils.sqlDateTime(expireDate);
		return expireDateString;	
	}

	api.cache.exists = function(api, key, next){
		api.models.cache.count({ where: {key: key} }).on('success', function(num) {
			if(num == 1){ 
				process.nextTick(function() { next(true); });
			}else{ 
				process.nextTick(function() { next(false); });
			}
		});
	};

	api.cache.save = function(api,key,value,expireTimeSeconds,next){
		if(expireTimeSeconds < 0 || expireTimeSeconds == null){ expireTimeSeconds = api.configData.cache.defaultExpireTimeSeconds; }
		var expireTimeString = api.cache.buildSQLExpireString(api, expireTimeSeconds);
		api.cache.exists(api, key, function(exists){
			if(exists)
			{
				api.models.cache.find({ where: {key: key} }).on('success', function(entry) {
					if(value == null){value = JSON.parse(entry.value);}
					entry.updateAttributes({
					  value: JSON.stringify(value),
					  expireTime: expireTimeString
					}).on('success', function(){
						process.nextTick(function() { next("updated record"); });
					});
				});
			}
			else
			{
				api.models.cache.build({
					key: key,
					value: JSON.stringify(value),
					expireTime: expireTimeString
				}).save().on('success', function() {
					process.nextTick(function() { next("new record"); });
				});
			}
		});
	};

	api.cache.load = function(api, key, next){
		var nowSQLString = api.utils.sqlDateTime();
		api.models.cache.find({ where: ["`key` = ? and expireTime > ?", key, nowSQLString] }).on('success', function(entry) {
			if(entry){
				var resp = JSON.parse(entry.value);
				process.nextTick(function() { next(resp); });
			}else{
				process.nextTick(function() { next(false); });
			}
		});
	};

	api.cache.destroy = function(api, key, next){
		api.models.cache.find({ where: {key: key} }).on('success', function(entry) {
			if(entry){
				entry.destroy();
				process.nextTick(function() { next(true); });
			}else{
				process.nextTick(function() { next(false); });
			}
		});
	};
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initCache = initCache;
