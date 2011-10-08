function file(api, next)
{
	var fileName = api.params.fileName || api.req.params[0].split("/")[1];
	fileName = "./public/" + fileName;
	api.path.exists(fileName, function(exists) {
		if(exists)
		{
			api.res.sendfile(fileName);
			next(false);
		}
		else
		{
			api.res.send('Sorry, that file is not found :(', 404);
			next(false);
		}
	});
};

exports.file = file;