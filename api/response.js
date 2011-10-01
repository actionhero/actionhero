function build_response()
{	
	this.response = this.response || {};
	// generic information
	this.response.serverInformation = {};
	this.response.serverInformation.serverName = this.configData.serverName
	this.response.serverInformation.apiVerson = this.configData.apiVerson
	
	// request timer
	this.timer.stopTime = new Date().getTime();
	this.response.serverInformation.requestDuration = this.timer.stopTime - this.timer.startTime;
	
	return this.response;
};

exports.build_response = build_response;