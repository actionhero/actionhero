////////////////////////////////////////////////////////////////////////////
// DB setup
//
// All DB connection options must define: api.rateLimitCheck = function(api, connection, next) which will be used in all web connections.  It should return requestThisHourSoFar (int)

var initDB = function(api, next){	
	if(api.configData.database != null){
		
		////////////////////////////////////////////////////////////////////////////
		// mySQL
		if(api.configData.database.type == "mySQL"){
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
							api.log("DB conneciton sucessfull and Objects mapped to DB tables", "green");
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
			
			// define the rate limit check function
			api.rateLimitCheck = function(api, connection, next){
				api.models.log.count({where: ["ip = ? AND createdAt > (NOW() - INTERVAL 1 HOUR)", connection.remoteIP]}).on('success', function(requestThisHourSoFar) {
					next(requestThisHourSoFar);
				});
			}
		}
		////////////////////////////////////////////////////////////////////////////
		// Unknown DB Type
		else{
			api.log("I do not know how to initialze a database of type: "+api.configData.database.type+".  Exiting.", "red");
			process.exit();
		}
	}else{
		api.rateLimitCheck = function(api, connection, next){ next(1); }
		next();
	}
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initDB = initDB;