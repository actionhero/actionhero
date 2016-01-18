// error messages can be strings of objects
var util = require('util');

exports.default = {
  errors: function(api){
    return {
      '_toExpand': false,

      /////////////////
      // SERIALIZERS //
      /////////////////

      serializers: {
        servers: {
          web: function(error){
            if(util.isError(error)){
              return String( error.message );
            }else{
              return error;
            }
          },
          websocket: function(error){
            if(util.isError(error)){
              return String( error.message );
            }else{
              return error;
            }
          },
          socket: function(error){
            if(util.isError(error)){
              return String( error.message );
            }else{
              return error;
            }
          },
          specHelper: function(error){
            if(util.isError(error)){
              return 'Error: ' + String( error.message );
            }else{
              return error;
            }
          },
        }
      },

      /////////////
      // ACTIONS //
      /////////////

      // When a params for an action is invalid
      invalidParams: function(data, validationErrors){
        return validationErrors.join(', ');
      },

      // When a required param for an action is not provided
      missingParams: function(data, missingParams){
        return data.connection.localize(['%s is a required parameter for this action', missingParams[0]]);
      },

      // user requested an unknown action
      unknownAction: function(data){
        return data.connection.localize('unknown action or invalid apiVersion');
      },

      // action not useable by this client/server type
      unsupportedServerType: function(data){
        return data.connection.localize(['this action does not support the %s connection type', data.connection.type]);
      },

      // action failed because server is mid-shutdown
      serverShuttingDown: function(data){
        return data.connection.localize('the server is shutting down');
      },

      // action failed because this client already has too many pending acitons
      // limit defined in api.config.general.simultaneousActions
      tooManyPendingActions: function(data){
        return data.connection.localize('you have too many pending requests');
      },

      /////////////////
      // FILE SERVER //
      /////////////////

      // The body message to accompany 404 (file not found) errors regarding flat files
      // You may want to load in the contnet of 404.html or similar
      fileNotFound: function(connection){
        return connection.localize(['That file is not found (%s)', connection.params.file]);
      },

      // user didn't request a file
      fileNotProvided: function(connection){
        return connection.localize('file is a required param to send a file');
      },

      // something went wrong trying to read the file
      fileReadError: function(connection, error){
        return connection.localize(['error reading file: %s', String(error)]);
      },

      /////////////////
      // CONNECTIONS //
      /////////////////

      verbNotFound: function(connection, verb){
        return connection.localize(['I do not know know to perform this verb (%s)', verb]);
      },

      verbNotAllowed: function(connection, verb){
        return connection.localize(['verb not found or not allowed (%s)', verb]);
      },

      connectionRoomAndMessage: function(connection){
        return connection.localize('both room and message are required');
      },

      connectionNotInRoom: function(connection, room){
        return connection.localize(['connection not in this room (%s)', room]);
      },

      connectionAlreadyInRoom: function(connection, room){
        return connection.localize(['connection already in this room (%s)', room]);
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

    };
  }
};
