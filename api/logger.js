function log(original_message)
{	
	var d = new Date();
	message = this.utils.sqlDateTime() + " | " + original_message;
	console.log(message);
	if(this.configData.logging)
	{
		if (this.logWriter == null)
		{
			this.logWriter = this.fs.createWriteStream((this.configData.logFolder + "/" + this.configData.logFile), {flags:"a"});
		}
		
		try{
			this.logWriter.write(message + "\r\n");
		}catch(e){
			console.log(" !!! Error writing to log file: " + e);
		}
	}
};

exports.log = log;