var task = {};

/////////////////////////////////////////////////////////////////////
// metadata
task.name = "caclculateStats";
task.description = "I will caclculate this (local) server's stats";
task.scope = "all";
task.frequency = 10000;

/////////////////////////////////////////////////////////////////////
// functional
task.run = function(api, params, next){
	api.stats.calculate(api, function(){
		next(true, null);
	}) ;
};

/////////////////////////////////////////////////////////////////////
// exports
exports.task = task;
