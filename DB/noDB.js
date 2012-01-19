////////////////////////////////////////////////////////////////////////////
// DB setup
//
// All DB connection options must define: api.rateLimitCheck = function(api, connection, next) which will be used in all web connections.  It should return requestThisHourSoFar (int)
// You can add DB specific by adding your task to the api.taks object
// Your DB init function should be called init and be exported.  init = function(api, next)
// Name your DB init file the same thing you want folks to use in api.configData.database.type

var init = function(api, next){
	api.rateLimitCheck = function(api, connection, next){ next(1); }
	// no extra tasks needed
	next();
}

exports.init = init;
