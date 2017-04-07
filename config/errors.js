'use strict'

// error messages can be strings of objects
exports['default'] = {
  errors: function (api) {
    return {
      '_toExpand': false,

      // ///////////////
      // SERIALIZERS //
      // ///////////////

      serializers: {
        servers: {
          web: function (error) {
            if (error.message) {
              return String(error.message)
            } else {
              return error
            }
          },
          websocket: function (error) {
            if (error.message) {
              return String(error.message)
            } else {
              return error
            }
          },
          socket: function (error) {
            if (error.message) {
              return String(error.message)
            } else {
              return error
            }
          },
          specHelper: function (error) {
            if (error.message) {
              return 'Error: ' + String(error.message)
            } else {
              return error
            }
          }
        }
      },

      // ///////////
      // ACTIONS //
      // ///////////

      // When a params for an action is invalid
      invalidParams: function (data, validationErrors) {
        if (validationErrors.length >= 0) { return validationErrors[0] }
        return 'validation error'
      },

      // When a required param for an action is not provided
      missingParams: function (data, missingParams) {
        return data.connection.localize(['{{param}} is a required parameter for this action', {param: missingParams[0]}])
      },

      // user requested an unknown action
      unknownAction: function (data) {
        return data.connection.localize('unknown action or invalid apiVersion')
      },

      // action not useable by this client/server type
      unsupportedServerType: function (data) {
        return data.connection.localize(['this action does not support the {{type}} connection type', {type: data.connection.type}])
      },

      // action failed because server is mid-shutdown
      serverShuttingDown: function (data) {
        return data.connection.localize('the server is shutting down')
      },

      // action failed because this client already has too many pending acitons
      // limit defined in api.config.general.simultaneousActions
      tooManyPendingActions: function (data) {
        return data.connection.localize('you have too many pending requests')
      },

      dataLengthTooLarge: function (maxLength, receivedLength) {
        return api.i18n.localize(['data length is too big ({{maxLength}} received/{{receivedLength}} max)', {maxLength: maxLength, receivedLength: receivedLength}])
      },

      // ///////////////
      // FILE SERVER //
      // ///////////////

      // The body message to accompany 404 (file not found) errors regarding flat files
      // You may want to load in the contnet of 404.html or similar
      fileNotFound: function (connection) {
        return connection.localize(['That file is not found'])
      },

      // user didn't request a file
      fileNotProvided: function (connection) {
        return connection.localize('file is a required param to send a file')
      },

      // something went wrong trying to read the file
      fileReadError: function (connection, error) {
        return connection.localize(['error reading file: {{error}}', {error: String(error)}])
      },

      // ///////////////
      // CONNECTIONS //
      // ///////////////

      verbNotFound: function (connection, verb) {
        return connection.localize(['I do not know know to perform this verb ({{verb}})', {verb: verb}])
      },

      verbNotAllowed: function (connection, verb) {
        return connection.localize(['verb not found or not allowed ({{verb}})', {verb: verb}])
      },

      connectionRoomAndMessage: function (connection) {
        return connection.localize('both room and message are required')
      },

      connectionNotInRoom: function (connection, room) {
        return connection.localize(['connection not in this room ({{room}})', {room: room}])
      },

      connectionAlreadyInRoom: function (connection, room) {
        return connection.localize(['connection already in this room ({{room}})', {room: room}])
      },

      connectionRoomHasBeenDeleted: function (room) {
        return api.i18n.localize('this room has been deleted')
      },

      connectionRoomNotExist: function (room) {
        return api.i18n.localize('room does not exist')
      },

      connectionRoomExists: function (room) {
        return api.i18n.localize('room exists')
      },

      connectionRoomRequired: function (room) {
        return api.i18n.localize('a room is required')
      }

    }
  }
}
