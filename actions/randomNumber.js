exports.action = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  inputs: {
    'required' : [],
    'optional' : []
  },
  blockedConnectionTypes: [],
  outputExample: {
    randomNumber: 123
  },
  run: function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  }
};
