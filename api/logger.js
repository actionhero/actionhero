function log(original_message)
{
	var d = new Date();
	message = this.utils.sqlDateTime() + " | " + original_message;
	console.log(message);
	if(this.configData.logging)
	{
		this.fs.createWriteStream((this.configData.logFolder + "/" + this.configData.logFile), {flags:"a"}).write(message + "\r\n");
	}
};

exports.log = log;