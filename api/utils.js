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
// blocking sleep
utils.sleep = function ZZzzzZZzzzzzzZZZz(naptime)
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