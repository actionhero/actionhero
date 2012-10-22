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
action.run = function(api, connection, next){
	api.sendFile(api, connection, function(conn, resp){
		next(conn, resp);
	})
}

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;