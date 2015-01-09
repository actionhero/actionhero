exports.randomNumber = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  outputExample: {},

  inputs: {
    required : [],
    optional : []
  },

  run: function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  }

};