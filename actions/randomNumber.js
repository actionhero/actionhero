exports.randomNumber = {
  name: 'randomNumber',
  description: 'I am an API method which will generate a random number',
  outputExample: {},
  
  run: function(api, connection, next){
    connection.response.randomNumber = Math.random();
    next(connection, true);
  }

};