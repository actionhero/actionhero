function randomNumber(api, next)
{
	api.response.randomNumber = Math.random();
	next(true);
};

exports.randomNumber = randomNumber;