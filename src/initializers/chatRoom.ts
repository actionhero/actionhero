import { api, id, log, config, Initializer } from "../index";
import { Connection } from "../classes/connection";
import { PubSubMessage } from "../initializers/redis";

/**
 * Middleware definition for processing chat events.  Can be of the
 *
 * ```js
 *  var chatMiddleware = {
 *    name: 'chat middleware',
 *    priority: 1000,
 *    join: (connection, room) => {
 *      // announce all connections entering a room
 *      api.chatRoom.broadcast({}, room, 'I have joined the room: ' + connection.id, callback)
 *    },
 *    leave:(connection, room, callback) => {
 *      // announce all connections leaving a room
 *      api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, callback)
 *    },
 *    // Will be executed once per client connection before delivering the message.
 *    say: (connection, room, messagePayload) => {
 *      // do stuff
 *      log(messagePayload)
 *    },
 *    // Will be executed only once, when the message is sent to the server.
 *    onSayReceive: (connection, room, messagePayload) => {
 *      // do stuff
 *      log(messagePayload)
 *    }
 * }
 * api.chatRoom.addMiddleware(chatMiddleware)
 * ```
 */

export interface ChatMiddleware {
  /**Unique name for the middleware. */
  name: string;
  /**Module load order. Defaults to `api.config.general.defaultMiddlewarePriority`. */
  priority?: number;
  /**Called when a connection joins a room. */
  join?: Function;
  /**Called when a connection leaves a room. */
  leave?: Function;
  /**Called when a connection says a message to a room. */
  onSayReceive?: Function;
  /**Called when a connection is about to recieve a say message. */
  say?: Function;
}

export interface ChatPubSubMessage extends PubSubMessage {
  messageType: string;
  serverToken: string;
  serverId: string | number;
  message: any;
  sentAt: number;
  connection: {
    id: string;
    room: string;
  };
}

export interface ChatRoomApi {
  middleware: {
    [key: string]: ChatMiddleware;
  };
  globalMiddleware: Array<string>;
  keys: { [keys: string]: string };
  messageChannel: string;
  addMiddleware?: Function;
  broadcast?: Function;
  generateMessagePayload?: Function;
  runMiddleware?: Function;
  incomingMessagePerConnection?: Function;
  incomingMessage?: Function;
  list?: Function;
  add?: Function;
  exists?: Function;
  destroy?: Function;
  removeMember?: Function;
  sanitizeMemberDetails?: Function;
  roomStatus?: Function;
  generateMemberDetails?: Function;
  addMember?: Function;
}

/**
 * Chat & Realtime Communication Methods
 */
export class ChatRoom extends Initializer {
  constructor() {
    super();
    this.name = "chatRoom";
    this.loadPriority = 520;
    this.startPriority = 200;
  }

  async initialize() {
    if (config.redis.enabled === false) {
      return;
    }

    api.chatRoom = {
      middleware: {},
      globalMiddleware: [],
      messageChannel: "/actionhero/chat/chat",
      keys: {
        rooms: "actionhero:chatRoom:rooms",
        members: "actionhero:chatRoom:members:"
      }
    };

    /**
     * Add a middleware component to connection handling.
     */
    api.chatRoom.addMiddleware = (data: ChatMiddleware) => {
      if (!data.name) {
        throw new Error("middleware.name is required");
      }
      if (!data.priority) {
        data.priority = config.general.defaultMiddlewarePriority;
      }
      data.priority = Number(data.priority);
      api.chatRoom.middleware[data.name] = data;

      api.chatRoom.globalMiddleware.push(data.name);
      api.chatRoom.globalMiddleware.sort((a, b) => {
        if (
          api.chatRoom.middleware[a].priority >
          api.chatRoom.middleware[b].priority
        ) {
          return 1;
        } else {
          return -1;
        }
      });
    };

    /**
     * Send a message to all members of a chat room.  This is used by the server.
     */
    api.chatRoom.broadcast = async (
      connection: Connection,
      room: string,
      message: object | Array<any> | string
    ) => {
      if (!room || !message) {
        throw new Error(config.errors.connectionRoomAndMessage(connection));
      } else if (
        connection.rooms === undefined ||
        connection.rooms.indexOf(room) > -1
      ) {
        const payload: ChatPubSubMessage = {
          messageType: "chat",
          serverToken: config.general.serverToken,
          serverId: id,
          message: message,
          sentAt: new Date().getTime(),
          connection: {
            id: connection.id || "0",
            room: room
          }
        };

        const messagePayload = api.chatRoom.generateMessagePayload(payload);
        const newPayload = await api.chatRoom.runMiddleware(
          connection,
          messagePayload.room,
          "onSayReceive",
          messagePayload
        );
        const payloadToSend: ChatPubSubMessage = {
          messageType: "chat",
          serverToken: config.general.serverToken,
          serverId: id,
          message: newPayload.message,
          sentAt: newPayload.sentAt,
          connection: {
            id: newPayload.from,
            room: newPayload.room
          }
        };

        await api.redis.publish(payloadToSend);
      } else {
        throw new Error(config.errors.connectionNotInRoom(connection, room));
      }
    };

    api.chatRoom.generateMessagePayload = message => {
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: "user",
        sentAt: message.sentAt
      };
    };

    api.chatRoom.incomingMessage = message => {
      const messagePayload = api.chatRoom.generateMessagePayload(message);
      Object.keys(api.connections.connections).forEach(connetionId => {
        const connection = api.connections.connections[connetionId];
        // we can parallize this, no need to await
        api.chatRoom.incomingMessagePerConnection(connection, messagePayload);
      });
    };

    api.chatRoom.incomingMessagePerConnection = async (
      connection: Connection,
      messagePayload: ChatPubSubMessage
    ) => {
      if (
        connection.canChat === true &&
        connection.rooms.indexOf(messagePayload.room) > -1
      ) {
        try {
          const newMessagePayload = await api.chatRoom.runMiddleware(
            connection,
            messagePayload.room,
            "say",
            messagePayload
          );
          connection.sendMessage(newMessagePayload, "say");
        } catch (error) {
          log(error, "warning", { messagePayload, connection });
        }
      }
    };

    /**
     * List all chat rooms created
     */
    api.chatRoom.list = async (): Promise<Array<string>> => {
      return api.redis.clients.client.smembers(api.chatRoom.keys.rooms);
    };

    /**
     * Add a new chat room.  Throws an error if the room already exists.
     */
    api.chatRoom.add = async (room: string) => {
      const found = await api.chatRoom.exists(room);
      if (found === false) {
        return api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room);
      } else {
        throw new Error(await config.errors.connectionRoomExists(room));
      }
    };

    /**
     * Remove an exsitng chat room.  All connections in the room will be removed.  Throws an error if the room does not exist.
     */
    api.chatRoom.destroy = async (room: string) => {
      const found = await api.chatRoom.exists(room);
      if (found === true) {
        await api.chatRoom.broadcast(
          {},
          room,
          await config.errors.connectionRoomHasBeenDeleted(room)
        );
        const membersHash = await api.redis.clients.client.hgetall(
          api.chatRoom.keys.members + room
        );

        for (const id in membersHash) {
          await api.chatRoom.removeMember(id, room, false);
        }

        await api.redis.clients.client.srem(api.chatRoom.keys.rooms, room);
        await api.redis.clients.client.del(api.chatRoom.keys.members + room);
      } else {
        throw new Error(await config.errors.connectionRoomNotExist(room));
      }
    };

    /**
     * Check if a room exists.
     */
    api.chatRoom.exists = async (room: string): Promise<boolean> => {
      const bool = await api.redis.clients.client.sismember(
        api.chatRoom.keys.rooms,
        room
      );
      let found = false;
      // @ts-ignore
      if (bool === 1 || bool === true) {
        found = true;
      }
      return found;
    };

    /**
     * An overwritable method which configures what properties of connections in a room to return via `api.chatRoom.roomStatus`
     */
    api.chatRoom.sanitizeMemberDetails = memberData => {
      return {
        id: memberData.id,
        joinedAt: memberData.joinedAt
      };
    };

    /**
     * Learn about the connections in the room.
     * Returns a hash of the form { room: room, members: cleanedMembers, membersCount: count }.  Members is an array of connections in the room sanitized via `api.chatRoom.sanitizeMemberDetails`
     */
    api.chatRoom.roomStatus = async (room: string): Promise<object> => {
      if (room) {
        const found = await api.chatRoom.exists(room);
        if (found === true) {
          const key = api.chatRoom.keys.members + room;
          const members = await api.redis.clients.client.hgetall(key);
          const cleanedMembers = {};
          let count = 0;

          for (const id in members) {
            const data = JSON.parse(members[id]);
            cleanedMembers[id] = api.chatRoom.sanitizeMemberDetails(data);
            count++;
          }

          return {
            room: room,
            members: cleanedMembers,
            membersCount: count
          };
        } else {
          throw new Error(await config.errors.connectionRoomNotExist(room));
        }
      } else {
        throw new Error(await config.errors.connectionRoomRequired());
      }
    };

    /**
     * An overwritable method which configures what properties of connections in a room are initially stored about a connection when added via `api.chatRoom.addMember`
     */
    api.chatRoom.generateMemberDetails = (connection: Connection) => {
      return {
        id: connection.id,
        joinedAt: new Date().getTime(),
        host: id
      };
    };

    /**
     * Add a connection (via id) to a rooom.  Throws errors if the room does not exist, or the connection is already in the room.  Middleware errors also throw.
     */
    api.chatRoom.addMember = async (
      connectionId: string,
      room: string
    ): Promise<boolean> => {
      const connection = api.connections.connections[connectionId];
      if (!connection) {
        return api.redis.doCluster(
          "api.chatRoom.addMember",
          [connectionId, room],
          connectionId,
          true
        );
      }

      if (connection.rooms.indexOf(room) >= 0) {
        throw new Error(
          await config.errors.connectionAlreadyInRoom(connection, room)
        );
      }

      if (connection.rooms.indexOf(room) < 0) {
        const found = await api.chatRoom.exists(room);
        if (!found) {
          throw new Error(await config.errors.connectionRoomNotExist(room));
        }
      }

      if (connection.rooms.indexOf(room) < 0) {
        await api.chatRoom.runMiddleware(connection, room, "join");
      }

      if (connection.rooms.indexOf(room) < 0) {
        const memberDetails = api.chatRoom.generateMemberDetails(connection);
        connection.rooms.push(room);
        await api.redis.clients.client.hset(
          api.chatRoom.keys.members + room,
          connection.id,
          JSON.stringify(memberDetails)
        );
      }

      return true;
    };

    /**
     * Remote a connection (via id) from a rooom.  Throws errors if the room does not exist, or the connection is not in the room.  Middleware errors also throw.
     * toWaitRemote: Should this method wait until the remote ActionHero server (the one the connection is connected too) responds?
     */
    api.chatRoom.removeMember = async (
      connectionId: string,
      room: string,
      toWaitRemote: boolean = true
    ): Promise<boolean> => {
      const connection = api.connections.connections[connectionId];
      if (!connection) {
        return api.redis.doCluster(
          "api.chatRoom.removeMember",
          [connectionId, room],
          connectionId,
          toWaitRemote
        );
      }

      if (connection.rooms.indexOf(room) < 0) {
        throw new Error(
          await config.errors.connectionNotInRoom(connection, room)
        );
      }

      if (connection.rooms.indexOf(room) >= 0) {
        const found = await api.chatRoom.exists(room);
        if (!found) {
          throw new Error(await config.errors.connectionRoomNotExist(room));
        }
      }

      if (connection.rooms.indexOf(room) >= 0) {
        await api.chatRoom.runMiddleware(connection, room, "leave");
      }

      if (connection.rooms.indexOf(room) >= 0) {
        const index = connection.rooms.indexOf(room);
        connection.rooms.splice(index, 1);
        await api.redis.clients.client.hdel(
          api.chatRoom.keys.members + room,
          connection.id
        );
      }

      return true;
    };

    api.chatRoom.runMiddleware = async (
      connection: Connection,
      room: string,
      direction: string,
      messagePayload: ChatPubSubMessage
    ) => {
      let newMessagePayload: ChatPubSubMessage;
      if (messagePayload) {
        newMessagePayload = Object.assign({}, messagePayload);
      }

      for (const name of api.chatRoom.globalMiddleware) {
        const m = api.chatRoom.middleware[name];
        if (typeof m[direction] === "function") {
          if (messagePayload) {
            const data = await m[direction](
              connection,
              room,
              newMessagePayload
            );
            if (data) {
              newMessagePayload = data;
            }
          } else {
            await m[direction](connection, room);
          }
        }
      }
      return newMessagePayload;
    };
  }

  async start() {
    if (config.redis.enabled === false) {
      return;
    }

    api.redis.subscriptionHandlers.chat = message => {
      if (api.chatRoom) {
        api.chatRoom.incomingMessage(message);
      }
    };

    if (config.general.startingChatRooms) {
      const rooms = Object.keys(config.general.startingChatRooms);
      for (const room of rooms) {
        log(`ensuring the existence of the chatRoom: ${room}`);
        try {
          await api.chatRoom.add(room);
        } catch (error) {
          if (
            !error
              .toString()
              .match(await config.errors.connectionRoomExists(room))
          ) {
            throw error;
          }
        }
      }
    }
  }
}
