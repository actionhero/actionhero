function randomNumber(api, next)
{
	api.response.randomNumber = Math.random();
	next();
};

exports.randomNumber = randomNumber;