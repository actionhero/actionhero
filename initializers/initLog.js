////////////////////////////////////////////////////////////////////////////
// logging

var initLog = function(api, next){
	
	try { api.fs.mkdirSync(api.configData.logFolder, "777") } catch(e) {}; 
	
	api.log = function(original_message, styles){	
		if(api.configData != null && api.configData.logging == true)
		{
			// styles is an array of styles
			if (styles == null){styles = ["white"];}

			if(api.utils != undefined){
				var time_string = api.utils.sqlDateTime();
			}else{
				var time_string = "!";
			}
			if(api.cluster.isWorker){
				time_string += " [" + process.pid + "]";
			}

			var console_message = api.consoleColors.grey(time_string) + api.consoleColors.grey(" | ");
			var inner_message = original_message;
			for(var i in styles){
				var style = styles[i];
				if(style == "bold"){inner_message = api.consoleColors.bold(inner_message);}
				else if(style == "italic"){inner_message = api.consoleColors.italic(inner_message);}
				else if(style == "underline"){inner_message = api.consoleColors.underline(inner_message);}
				else if(style == "inverse"){inner_message = api.consoleColors.inverse(inner_message);}
				else if(style == "white"){inner_message = api.consoleColors.white(inner_message);}
				else if(style == "grey"){inner_message = api.consoleColors.grey(inner_message);}
				else if(style == "black"){inner_message = api.consoleColors.black(inner_message);}
				else if(style == "blue"){inner_message = api.consoleColors.blue(inner_message);}
				else if(style == "cyan"){inner_message = api.consoleColors.cyan(inner_message);}
				else if(style == "green"){inner_message = api.consoleColors.green(inner_message);}
				else if(style == "yellow"){inner_message = api.consoleColors.yellow(inner_message);}
				else if(style == "red"){inner_message = api.consoleColors.red(inner_message);}
				else if(style == "cyan"){inner_message = api.consoleColors.cyan(inner_message);}
				else if(style == "magenta"){inner_message = api.consoleColors.magenta(inner_message);}
				else if(style == "rainbow"){inner_message = api.consoleColors.rainbow(inner_message);}
				else if(style == "black"){inner_message = api.consoleColors.black(inner_message);}
				else if(style == "zebra"){inner_message = api.consoleColors.zebra(inner_message);}
				else if(style == "zalgo"){inner_message = api.consoleColors.zalgo(inner_message);}
			}
			console_message += inner_message;
			console.log(console_message);
			var file_message = time_string + " | " + original_message;
			if (api.logWriter == null){
				api.logWriter = api.fs.createWriteStream((api.configData.logFolder + "/" + api.configData.logFile), {flags:"a"});
			}
			process.nextTick(function() { 
				try{
					api.logWriter.write(file_message + "\r\n");
				}catch(e){
					console.log(" !!! Error writing to log file: " + e);
				}
			});
		}
	};
	
	next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initLog = initLog;
