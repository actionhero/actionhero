function buildWebResponse(connection)
{	
	connection.response = connection.response || {};
		
	// serverInformation information
	connection.response.serverInformation = {};
	connection.response.serverInformation.serverName = this.configData.serverName;
	connection.response.serverInformation.apiVerson = this.configData.apiVerson;
	
	// requestorInformation
	connection.response.requestorInformation = {};
	connection.response.requestorInformation.remoteAddress = connection.remoteIP;
	connection.response.requestorInformation.RequestsRemaining = this.configData.apiRequestLimit - connection.requestCounter;
	connection.response.requestorInformation.recievedParams = {};
	for(var k in connection.params){
		if(connection.params[k] != undefined){
			connection.response.requestorInformation.recievedParams[k] = connection.params[k] ;
		}
	};
	
	// request timer
	connection.timer.stopTime = new Date().getTime();
	connection.response.serverInformation.requestDuration = connection.timer.stopTime - connection.timer.startTime;
		
	// errors
	if(connection.error == false)
	{
		connection.response.error = "OK";
	}
	else
	{
		connection.response.error = connection.error;
	}
		
	if(connection.params.callback != null)
	{
		return connection.params.callback + "(" + JSON.stringify(connection.response) + ");";
	}
	
	return JSON.stringify(connection.response);
};

exports.buildWebResponse = buildWebResponse;