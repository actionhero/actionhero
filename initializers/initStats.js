////////////////////////////////////////////////////////////////////////////
// initStats

var initStats = function(api, next){
	api.stats = {};
	var cacheTime = 1000*60*60*24*365 // 1 year
	
	api.stats.init = function(api, next){
		var stats = {};
		stats.numberOfWebRequests = 0;
		stats.numberOfSocketRequests = 0;
		stats.startTime = new Date().getTime();	
		stats.pid = process.pid;
		api.cache.save(api, "_stats", stats, cacheTime, function(){
			next();
		});
	}
	
	api.stats.load = function(next){
		api.stats.calculate(api, function(){
			api.actionCluster.cache.load(api, "_stats", function(clusterResp){
				if(clusterResp == false){
					api.cache.load(api, "_stats", function(localResp){
						next(localResp);
					});
				}else{
					next(clusterResp);
				}
			});
		});
	}
	
	api.stats.calculate = function(api, next){
		api.cache.load(api, "_stats", function(stats){
			var now = new Date().getTime();
			stats.lastCalculation = now;
			stats.uptimeSeconds = (now - stats.startTime) / 1000;
			stats.cache = {
				numberOfObjects: api.utils.hashLength(api.cache.data)
			};
			stats.socketServer = {
				numberOfSocketRequests: api.socketServer.numberOfSocketRequests
			};
			stats.webServer = {
				numberOfWebRequests: api.webServer.numberOfWebRequests
			};
			stats.memoryConsumption = process.memoryUsage().heapUsed;
			stats.actionCluster = {
				peers: api.actionCluster.peers,
				clusterRequests: api.actionCluster.requestID
			};
			
			api.cache.save(api, "_stats", stats, cacheTime, function(){
				if(typeof next == "function"){ next(); }
			});
		});
	}
	
	api.stats.init(api, function(){
		next();
	});
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initStats = initStats;
