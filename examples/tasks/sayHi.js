exports.task = {
  name: 'sayHi',
  description: "I will periodically say 'hello' on all servers",
  scope: 'all',
  frequency: 5000,
  run: function(api, params, next){
    api.log('HELLO!', 'green');
    next();
  }
};
