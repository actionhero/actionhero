var utils = {};

////////////////////////////////////////////////////////////////////////////
// sqlDateTime
utils.sqlDateTime = function(){
	var temp = new Date();
	var dateStr = this.padDateDoubleStr(temp.getFullYear()) +
					"-" + 
	                  this.padDateDoubleStr(1 + temp.getMonth()) +
					"-" +
	                  this.padDateDoubleStr(temp.getDate()) +
					" " +
	                  this.padDateDoubleStr(temp.getHours()) +
					":" +
	                  this.padDateDoubleStr(temp.getMinutes()) +
					":" +
	                  this.padDateDoubleStr(temp.getSeconds());
	return dateStr;
};

////////////////////////////////////////////////////////////////////////////
// padDateDoubleStr
utils.padDateDoubleStr = function(i){
    return (i < 10) ? "0" + i : "" + i;
};

////////////////////////////////////////////////////////////////////////////
// generate a random string
utils.randomString = function(bits){
	var chars,rand,i,ret
	chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!'
	ret=''
  	while(bits > 0)
	{
	   rand=Math.floor(Math.random()*0x100000000) // 32-bit integer
	   for(i=26; i>0 && bits>0; i-=6, bits-=6) ret+=chars[0x3F & rand >>> i]
	}
	return ret
}

////////////////////////////////////////////////////////////////////////////
// count the number of elements in a hash
utils.hashLength = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

////////////////////////////////////////////////////////////////////////////
// blocking sleep
utils.sleepSync = function(naptime){
	naptime = naptime * 1000;
	var sleeping = true;
	var now = new Date();
	var alarm;
	var startingMSeconds = now.getTime();
	while(sleeping){
	    alarm = new Date();
	    alarmMSeconds = alarm.getTime();
	    if(alarmMSeconds - startingMSeconds > naptime){ sleeping = false; }
	}        
}

////////////////////////////////////////////////////////////////////////////
// sort an array of hashes by a key
utils.sort_by = function(field, reverse, primer){
   reverse = (reverse) ? -1 : 1;
   return function(a,b){
       a = a[field];
       b = b[field];
       if (typeof(primer) != 'undefined'){
           a = primer(a);
           b = primer(b);
       }
       if (a<b) return reverse * -1;
       if (a>b) return reverse * 1;
       return 0;
   }
}

////////////////////////////////////////////////////////////////////////////
// randomly sort an array
utils.randomArraySort = function(a,b) {
    return( parseInt( Math.random()*10 ) %2 );
}

////////////////////////////////////////////////////////////////////////////
// session authentication checking
utils.sessionCheck = function(api, connection, next){
	api.utils.requiredParamChecker(api, connection, ["sessionKey"]);
	if(connection.error == false)
	{
		api.models.session.find({ where: {key: connection.params.sessionKey} }).on('success', function(session) {
			if(session == null){
				connection.error = "sessionKey not found";
				process.nextTick(function() { next(false); });
			}else{
				api.models.user.find({ where: {id: session.userID} }).on('success', function(user) {
					if(user == null)
					{
						connection.error = "user not found";
						process.nextTick(function() { next(false); });
					}else{
						process.nextTick(function() { next(user); });
					}
				});
			}
		});
	}else{
		process.nextTick(function() { next(false); });
	}
}

////////////////////////////////////////////////////////////////////////////
// shellExec
utils.shellExec = function(api, command, next){
	var response = {};
	child = api.exec(command, function (error, stdout, stderr) {
		if (stdout.length > 0){ response.stdout = stdout.replace(/(\r\n|\n|\r)/gm,""); }else{response.stdout = stdout; }
		if (stderr.length > 0){ response.stderr = stderr.replace(/(\r\n|\n|\r)/gm,""); }else{response.stderr = stderr; }
	  	if (error !== null) {
			response.error = error.replace(/(\r\n|\n|\r)/gm,"");
	  	}
	  	process.nextTick(function() { next(response); });
	})
}

////////////////////////////////////////////////////////////////////////////
// api param checking
utils.requiredParamChecker = function(api, connection, required_params, mode){
	if(mode == null){mode = "all";}
	if(mode == "all"){
		required_params.forEach(function(param){
			if(connection.error == false && (connection.params[param] === undefined || connection.params[param].length == 0)){
				connection.error = param + " is a required parameter for this action";
			}
		});
	}
	if(mode == "any"){
		var paramString = "";
		var found = false;
		required_params.forEach(function(param){
			if(paramString != ""){paramString = paramString + ",";}
			paramString = paramString + " " + param;
			if(connection.params[param] != null){
				found = true;
			}
		});
		if(found == false)
		{
			connection.error = "none of the required params for this action were provided.  Any of the following are required: " + paramString;
		}
	}
}

////////////////////////////////////////////////////////////////////////////
// DB Seeding
utils.DBSeed = function(api, model, seeds, next){
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
					console.log(errors[i]);
				}
				next(false, model);
			});
		}
	});
}

////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.utils = utils;