function build_response(res)
{	
	this.response = this.response || {};
		
	// serverInformation information
	this.response.serverInformation = {};
	this.response.serverInformation.serverName = this.configData.serverName
	this.response.serverInformation.apiVerson = this.configData.apiVerson
	
	// requestorInformation
	this.response.requestorInformation = {};
	this.response.requestorInformation.remoteAddress = res.connection.remoteAddress;
	
	// request timer
	this.timer.stopTime = new Date().getTime();
	this.response.serverInformation.requestDuration = this.timer.stopTime - this.timer.startTime;
		
	// errors
	if(this.error == false)
	{
		this.response.error = "OK";
	}
	else
	{
		this.response.error = this.error;
	}
	
	return this.response;
};

exports.build_response = build_response;