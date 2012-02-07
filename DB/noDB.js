////////////////////////////////////////////////////////////////////////////
// DB setup
//
// You can add DB specific by adding your task to the api.taks object
// Your DB init function should be called init and be exported.  init = function(api, next)
// Name your DB init file the same thing you want folks to use in api.configData.database.type

var init = function(api, next){
	// no extra tasks needed
	next();
}

exports.init = init;
