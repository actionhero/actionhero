var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "file";
action.description = "I will reutrn a static file saved on the API server (usually in /public/).  If fileName is not a param, then I will assume the path specified is the file name.  I will not return a normal API response. I will return the file with proper headers and mime-types on sucess, and a 404 on error.";
action.inputs = {
	"required" : [],
	"optional" : ["fileName"]
};
action.outputExample = {}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next)
{
	var fileName = "";
	if(connection.params.fileName == null || typeof connection.params.fileName == "undefined"){
		var parts = connection.req.params[0].split("/");
		parts.shift();
		for (var i in parts){
			if (fileName != ""){ fileName += "/"; }
			fileName += parts[i];
		}
	}else{
		fileName = connection.params.fileName;
	}
	fileName = api.configData.flatFileDirectory + fileName;
	api.path.exists(fileName, function(exists) {
		if(exists)
		{
			connection.res.sendfile(fileName);
			next(connection, false);
		}
		else
		{
			connection.res.send('Sorry, that file is not found :(', 404);
			next(connection, false);
		}
	});
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;