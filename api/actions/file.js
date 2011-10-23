function file(api, connection, next)
{
	var fileName = connection.params.fileName || connection.req.params[0].split("/")[1];
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

exports.file = file;