// error messages can be strings of objects

exports.default = {
  errors: function(api){
    return {
      '_toExpand': false,

      ////////////////////
      // GENERAL ERRORS //
      ////////////////////

      // The message to accompany general 500 errors (internal server errors)
      serverErrorMessage: function(){
        return 'The server experienced an internal error';
      },

      /////////////
      // ACTIONS //
      /////////////

      // When a params for an action is invalid
      invalidParams: function(params){
        return params.join(", ");
      },

      // When a required param for an action is not provided
      missingParams: function(params){
        return params[0] + ' is a required parameter for this action';
      },

      // user requested an unknown action
      unknownAction: function(action){
        return 'unknown action or invalid apiVersion';
      },

      // action not useable by this client/server type
      unsupportedServerType: function(type){
        return 'this action does not support the ' + type + ' connection type';
      },

      // action failed because server is mid-shutdown
      serverShuttingDown: function(){
        return 'the server is shutting down';
      },

      // action failed because this client already has too many pending acitons
      // limit defined in api.config.general.simultaneousActions
      tooManyPendingActions: function(){
        return 'you have too many pending requests';
      },

      // a poorly designed action could try to call next() more than once
      doubleCallbackError: function(){
        return 'Double callback prevented within action';
      },

      /////////////////
      // FILE SERVER //
      /////////////////

      // The body message to accompany 404 (file not found) errors regarding flat files
      // You may want to load in the contnet of 404.html or similar
      fileNotFound: function(){
        return 'Sorry, that file is not found :(';
      },

      // user didn't request a file
      fileNotProvided: function(){
        return 'file is a required param to send a file';
      },

      // user requested a file not in api.config.paths.public
      fileInvalidPath: function(){
        return 'that is not a valid file path';
      },

      // something went wrong trying to read the file
      fileReadError: function(err){
        return 'error reading file: ' + String(err);
      },

      /////////////////
      // CONNECTIONS //
      /////////////////

      verbNotFound: function(verb){
        return 'I do not know know to perform this verb';
      },

      verbNotAllowed: function(verb){
        return 'verb not found or not allowed';
      },

      connectionRoomAndMessage: function(){
        return 'both room and message are required';
      },

      connectionNotInRoom: function(room){
        return 'connection not in this room';
      },

      connectionAlreadyInRoom: function(room){
        return 'connection already in this room';
      },

      connectionRoomHasBeenDeleted: function(room){
        return 'this room has been deleted';
      },

      connectionRoomNotExist: function(room){
        return 'room does not exist';
      },

      connectionRoomExists: function(room){
        return 'room exists';
      },

      connectionRoomRequired: function(room){
        return 'a room is required';
      },

    }
  }
}
