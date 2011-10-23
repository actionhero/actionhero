var utils = {};

////////////////////////////////////////////////////////////////////////////
// sqlDateTime
utils.sqlDateTime = function()
{
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
utils.padDateDoubleStr = function(i) 
{
    return (i < 10) ? "0" + i : "" + i;
};

////////////////////////////////////////////////////////////////////////////
// generate a random string
utils.randomString = function(bits)
{
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
// blocking sleep
utils.sleep = function(naptime)
{
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
// session authentication checking
utils.sessionCheck = function(api, connection, next)
{
	api.utils.requiredParamChecker(api, connection, ["sessionKey"]);
	if(connection.error == false)
	{
		api.models.session.find({ where: {key: connection.params.sessionKey} }).on('success', function(session) {
			if(session == null){
				connection.error = "sessionKey not found";
				next(false);
			}else{
				api.models.user.find({ where: {id: session.userID} }).on('success', function(user) {
					if(user == null)
					{
						connection.error = "user not found";
						next(false);
					}else{
						next(user);
					}
				});
			}
		});
	}else{
		next(false);
	}
}

////////////////////////////////////////////////////////////////////////////
// shellExec
utils.shellExec = function(api, command, next)
{
	var response = {};
	child = api.exec(command, function (error, stdout, stderr) {
	  	// api.sys.print('stdout: ' + stdout);
		response.stdout = stdout.replace(/(\r\n|\n|\r)/gm,"");
	  	// api.sys.print('stderr: ' + stderr);
		response.stderr = stderr.replace(/(\r\n|\n|\r)/gm,"");
	  	if (error !== null) {
	    	// console.log('exec error: ' + error);
			response.error = error.replace(/(\r\n|\n|\r)/gm,"");
	  	}
		next(response);
	})
}

////////////////////////////////////////////////////////////////////////////
// api param checking
utils.requiredParamChecker = function(api, connection, required_params)
{
	required_params.forEach(function(param){
		if(connection.error == false && (connection.params[param] === undefined || connection.params[param].length == 0)){
			connection.error = param + " is a required parameter for this action";
		}
	});
}

////////////////////////////////////////////////////////////////////////////
// Request Processing
exports.utils = utils;