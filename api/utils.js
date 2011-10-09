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
	chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
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
utils.sessionCheck = function(api, next)
{
	api.utils.requiredParamChecker(api, ["sessionKey"]);
	if(api.error == false)
	{
		api.models.session.find({ where: {key: api.params.sessionKey} }).on('success', function(session) {
			if(session == null){
				api.error = "sessionKey not found";
				next(false);
			}else{
				api.models.user.find({ where: {id: session.userID} }).on('success', function(user) {
					if(user == null)
					{
						api.error = "user not found";
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
// api param checking
utils.requiredParamChecker = function(api, required_params)
{
	required_params.forEach(function(param){
		if(api.error == false && (api.params[param] === undefined || api.params[param].length == 0)){
			api.error = param + " is a required parameter for this action";
		}
	});
}

////////////////////////////////////////////////////////////////////////////
// Request Processing
exports.utils = utils;