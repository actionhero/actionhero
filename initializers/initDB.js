////////////////////////////////////////////////////////////////////////////
// DB setup
//
// You can add DB specific by adding your task to the api.taks object
// Your DB init function should be called init and be exported.  init = function(api, next)
// Name your DB init file the same thing you want folks to use in api.configData.database.type

var initDB = function(api, next){	
	if(api.configData.database != null){
		var dbInitFile = "../DB/" + api.configData.database.type + ".js";
		if(api.path.existsSync(api.path.dirname(__filename) + '/' + dbInitFile)){
			require(dbInitFile).init(api, next); 
		}else{
			api.log("I do not know how to initialize a database of type: "+api.configData.database.type+"  Exiting.", "red");
			process.exit();
		}
	}else{
		require("../DB/noDB.js").init(api, next); 
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initDB = initDB;
