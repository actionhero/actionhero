module.exports = {
  initialize: function(api, next){
    api.test_initializer = 'OK';
    next();
  }
}


