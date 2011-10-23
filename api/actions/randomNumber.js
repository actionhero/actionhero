function randomNumber(api, connection, next)
{
	connection.response.randomNumber = Math.random();
	next(connection, true);
};

exports.randomNumber = randomNumber;