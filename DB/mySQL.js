////////////////////////////////////////////////////////////////////////////
// DB setup
//
// All DB connection options must define: api.rateLimitCheck = function(api, connection, next) which will be used in all web connections.  It should return requestThisHourSoFar (int)
// You can add DB specific by adding your task to the api.taks object
// Your DB init function should be called init and be exported.  init = function(api, next)
// Name your DB init file the same thing you want folks to use in api.configData.database.type

var init = function(api, next){
	api.mysql = require('mysql');
	api.SequelizeBase = require("sequelize");
	var rawDBParams = {
	  user: api.configData.database.username,
	  password: api.configData.database.password,
	  port: api.configData.database.port,
	  host: api.configData.database.host
	};
	api.rawDBConnction = api.mysql.createClient(rawDBParams);
	api.rawDBConnction.query('USE '+api.configData.database.database, function(e){
		if(e){
			api.log(" >> error connecting to database, exiting", ["red", "bold"]);
			api.log(JSON.stringify({database: rawDBParams.database, user: rawDBParams.user, host: rawDBParams.host, port: rawDBParams.port, password: "[censored]"}));
			process.exit();	
		}else{
			api.dbObj = new api.SequelizeBase(api.configData.database.database, api.configData.database.username, api.configData.database.password, {
				host: api.configData.database.host,
				port: api.configData.database.port,
				logging: api.configData.database.consoleLogging
			});

			api.models = {};
			api.seeds = {};
			api.modelsArray = [];

			var modelsPath = process.cwd() + "/models/";
			api.path.exists(modelsPath, function (exists) {
			  	if(!exists){
			  		var defaultModelsPath = process.cwd() + "/node_modules/actionHero/models/";
			  		api.log("no ./modles path in project, loading defaults from "+defaultModelsPath, "yellow");
					modelsPath = defaultModelsPath;
				}

				api.fs.readdirSync(modelsPath).forEach( function(file) {
					var modelName = file.split(".")[0];
					api.models[modelName] = require(modelsPath + file)['defineModel'](api);
					api.seeds[modelName] = require(modelsPath + file)['defineSeeds'](api);
					api.modelsArray.push(modelName); 
					api.log("model loaded: " + modelName, "blue");
				});
				api.dbObj.sync().on('success', function() {
					for(var i in api.seeds){
						var seeds = api.seeds[i];
						var model = api.models[i];
						if (seeds != null){
							api.utils.DBSeed(api, model, seeds, function(seeded, modelResp){
								if(seeded){ api.log("Seeded data for: "+modelResp.name, "cyan"); }
							});
						}
					}
					api.log("mySQL DB conneciton sucessfull and Objects mapped to DB tables", "green");
					next();
				}).on('failure', function(error) {
					api.log("trouble synchronizing models and DB.  Correct DB credentials?", "red");
					api.log(JSON.stringify(error));
					api.log("exiting", "red");
					process.exit();
				})
			});
		}
	});
			
	////////////////////////////////////////////////////////////////////////////
	// define the rate limit check function
	api.rateLimitCheck = function(api, connection, next){
		api.models.log.count({where: ["ip = ? AND createdAt > (NOW() - INTERVAL 1 HOUR)", connection.remoteIP]}).on('success', function(requestThisHourSoFar) {
			next(requestThisHourSoFar);
		});
	}
			
	////////////////////////////////////////////////////////////////////////////
	// special tasks for the DB
	api.tasks.cleanOldLogDB = function(api, next) {
		var params = {
			"name" : "Clean Task DB",
			"desc" : "I will remove old entires from the log DB."
		};
		var task = Object.create(api.tasks.Task);
		task.init(api, params, next);
		task.run = function() {
			if(api.models.log != null){
				api.models.log.findAll({where: ["createdAt < (NOW() - INTERVAL 2 HOUR)"]}).on('success', function(old_logs) {
					task.log("deleting "+old_logs.length+" old log DB entries");
					old_logs.forEach(function(log){
						log.destroy();
					});
					task.end();
				});
			}else{
				task.end();
			}
		};
		process.nextTick(function () { task.run() });
	};

	api.tasks.cleanOldSessionDB = function(api, next) {
		var params = {
			"name" : "Clean session DB",
			"desc" : "I will clean old sessions from the session DB."
		};
		var task = Object.create(api.tasks.Task);
		task.init(api, params, next);
		task.run = function() {
			if(api.models.session != null){
				api.models.session.findAll({where: ["updatedAt < DATE_SUB(NOW(), INTERVAL " + api.configData.sessionDurationMinutes + " MINUTE)"]}).on('success', function(old_sessions) {
					task.log("deleting "+old_sessions.length+" old session DB entries");
					old_sessions.forEach(function(entry){
						entry.destroy();
					});
					task.end();
				});
			}else{
				task.end();
			}
		};
		//
		process.nextTick(function () { task.run() });
	};
	
	////////////////////////////////////////////////////////////////////////////
	// DB Seeding
	api.utils.DBSeed = function(api, model, seeds, next){
		model.count().on('success', function(modelsFound) {
			if(modelsFound > 0)
			{
				next(false, model);
			}else{
				var chainer = new api.SequelizeBase.Utils.QueryChainer;
				for(var i in seeds){
					seed = seeds[i];
					chainer.add(model.build(seed).save());
				}
				chainer.run().on('success', function(){
					next(true, model);
				}).on('failure', function(errors){
					for(var i in errors){
						api.log(errors[i], "red");
					}
					next(false, model);
				});
			}
		});
	}
	
}

exports.init = init;