exports.action = {
  name: 'roomManager',
  description: 'I create and destroy chat rooms',
  inputs: {
    required: ['room', 'direction'],
    optional: ['authKey', 'authValue']
  },
  blockedConnectionTypes: [],
  outputExample: {},
  matchExtensionMimeType: false,
  version: 1.0,
  toDocument: true,
  run: function(api, connection, next){

    var handleAuth = function(callback){
      if(null !== connection.params.authKey && null !== connection.params.authValue){
        api.chatRoom.setAuthenticationPattern(connection.params.room, connection.params.authKey, connection.params.authValue, function(){
          callback();
        })
      } else {
        callback();
      }
    }

    if('add' === connection.params.direction){
      api.chatRoom.add(connection.params.room, function(){
        handleAuth(function(){
          next(connection, true);
        });
      });
    } else if('remove' === connection.params.direction){
      api.chatRoom.del(connection.params.room, function(){
        handleAuth(function(){
          next(connection, true);
        });
      });
    } else {
      connection.error = 'direction not understood';
      next(connection, true);
    }
    
  }
};
