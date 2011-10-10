function build_response(res)
{	
	this.response = this.response || {};
		
	// serverInformation information
	this.response.serverInformation = {};
	this.response.serverInformation.serverName = this.configData.serverName
	this.response.serverInformation.apiVerson = this.configData.apiVerson
	
	// requestorInformation
	this.response.requestorInformation = {};
	this.response.requestorInformation.remoteAddress = this.remoteIP;
	this.response.requestorInformation.RequestsRemaining = this.configData.apiRequestLimit - this.requestCounter;
	this.response.requestorInformation.recievedParams = this.params;
	
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
	
	this.response = JSON.stringify(this.response);
	
	if(this.params.callback != null)
	{
		this.response = this.params.callback + "(" + this.response + ");";
	}
	
	return this.response;
};

exports.build_response = build_response;