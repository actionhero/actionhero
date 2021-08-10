import { ActionProcessor } from "../classes/actionProcessor";
import { Connection, ConnectionVerb } from "../classes/connection";

export const DEFAULT = {
  errors: () => {
    return {
      _toExpand: false,

      // Should error types of "unknownAction" be included to the Exception handlers?
      reportUnknownActions: false,

      // ///////////////
      // SERIALIZERS //
      // ///////////////

      serializers: {
        servers: {
          web: (error: Error) => {
            if (error.message) {
              return String(error.message);
            } else {
              return error;
            }
          },
          websocket: (error: Error) => {
            if (error.message) {
              return String(error.message);
            } else {
              return error;
            }
          },
          specHelper: (error: Error) => {
            if (error.message) {
              return "Error: " + String(error.message);
            } else {
              return error;
            }
          },
        },
        // See ActionProcessor#applyDefaultErrorLogLineFormat to see an example of how to customize
        actionProcessor: null as (error: Error) => { [k: string]: string },
      },

      // ///////////
      // ACTIONS //
      // ///////////

      // When a params for an action is invalid
      invalidParams: (
        data: ActionProcessor<any>,
        validationErrors: Error[]
      ) => {
        if (validationErrors.length >= 0) return validationErrors[0];
        return "validation error";
      },

      // When a required param for an action is not provided
      missingParams: (data: ActionProcessor<any>, missingParams: string[]) => {
        return `${missingParams[0]} is a required parameter for this action`;
      },

      // user requested an unknown action
      unknownAction: (data: ActionProcessor<any>) => {
        return "unknown action or invalid apiVersion";
      },

      // action not useable by this client/server type
      unsupportedServerType: (data: ActionProcessor<any>) => {
        return `this action does not support the ${data.connection.type} connection type`;
      },

      // action failed because server is mid-shutdown
      serverShuttingDown: (data: ActionProcessor<any>) => {
        return "the server is shutting down";
      },

      // action failed because this client already has too many pending actions
      // limit defined in api.config.general.simultaneousActions
      tooManyPendingActions: (data: ActionProcessor<any>) => {
        return "you have too many pending requests";
      },

      // Decorate your response based on Error here.
      // Any action that throws an Error will pass through this method before returning
      //   an error to the client. Response can be edited here, status codes changed, etc.
      async genericError(data: ActionProcessor<any>, error: Error) {
        return error;
      },

      // ///////////////
      // FILE SERVER //
      // ///////////////

      // The body message to accompany 404 (file not found) errors regarding flat files
      // You may want to load in the content of 404.html or similar
      fileNotFound: (connection: Connection) => {
        return "That file is not found";
      },

      // user didn't request a file
      fileNotProvided: (connection: Connection) => {
        return "file is a required param to send a file";
      },

      // something went wrong trying to read the file
      fileReadError: (connection: Connection, error: Error) => {
        return `error reading file: ${error.message ?? error}`;
      },

      // ///////////////
      // CONNECTIONS //
      // ///////////////

      verbNotFound: (connection: Connection, verb: ConnectionVerb) => {
        return `I do not know know to perform this verb ${verb}`;
      },

      verbNotAllowed: (connection: Connection, verb: ConnectionVerb) => {
        return `verb not found or not allowed ${verb}`;
      },

      connectionRoomAndMessage: (connection: Connection) => {
        return `both room and message are required`;
      },

      connectionNotInRoom: (connection: Connection, room: string) => {
        return `connection not in this room ${room}`;
      },

      connectionAlreadyInRoom: (connection: Connection, room: string) => {
        return `connection already in this room ${room}`;
      },

      connectionRoomHasBeenDeleted: (room: string) => {
        return "this room has been deleted";
      },

      connectionRoomNotExist: (room: string) => {
        return "room does not exist";
      },

      connectionRoomExists: (room: string) => {
        return "room exists";
      },

      connectionRoomRequired: (room: string) => {
        return "a room is required";
      },
    };
  },
};
