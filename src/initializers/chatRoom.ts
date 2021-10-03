import { api, id, log, chatRoom, redis, Initializer } from "../index";
import { Connection } from "../classes/connection";
import * as ChatModule from "./../modules/chatRoom";

export interface ChatRoomApi {
  middleware: {
    [key: string]: ChatModule.chatRoom.ChatMiddleware;
  };
  globalMiddleware: Array<string>;
  keys: { [keys: string]: string };
  messageChannel: string;
  broadcast: ChatRoomInitializer["broadcast"];
  generateMessagePayload: ChatRoomInitializer["generateMessagePayload"];
  incomingMessage: ChatRoomInitializer["incomingMessage"];
  incomingMessagePerConnection: ChatRoomInitializer["incomingMessagePerConnection"];
  runMiddleware: ChatRoomInitializer["runMiddleware"];
}

/**
 * Chat & Realtime Communication Methods
 */
export class ChatRoomInitializer extends Initializer {
  config: any;

  constructor() {
    super();
    this.name = "chatRoom";
    this.loadPriority = 520;
    this.startPriority = 200;
  }

  async initialize(config) {
    this.config = config;

    api.chatRoom = {
      middleware: {},
      globalMiddleware: [],
      messageChannel: "/actionhero/chat/chat",
      keys: {
        rooms: "actionhero:chatRoom:rooms",
        members: "actionhero:chatRoom:members:",
      },
      broadcast: this.broadcast.bind(this),
      generateMessagePayload: this.generateMessagePayload.bind(this),
      incomingMessage: this.incomingMessage.bind(this),
      runMiddleware: this.runMiddleware.bind(this),
      incomingMessagePerConnection:
        this.incomingMessagePerConnection.bind(this),
    };
  }

  async start(config) {
    api.redis.subscriptionHandlers.chat = (message) => {
      if (api.chatRoom) {
        api.chatRoom.incomingMessage(message);
      }
    };

    if (config.general.startingChatRooms) {
      const rooms = Object.keys(config.general.startingChatRooms);
      for (const room of rooms) {
        log(`ensuring the existence of the chatRoom: ${room}`, "debug");
        try {
          await chatRoom.add(room);
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

  /**
   * Send a message to all members of a chat room.  This is used by the server.
   */
  async broadcast(
    connection: Connection,
    room: string,
    message: Record<string, any> | Array<any> | string
  ) {
    if (!room || !message) {
      throw new Error(this.config.errors.connectionRoomAndMessage(connection));
    } else if (
      connection.rooms === undefined ||
      connection.rooms.indexOf(room) > -1
    ) {
      const payload: ChatModule.chatRoom.ChatPubSubMessage = {
        messageType: "chat",
        serverToken: this.config.general.serverToken,
        serverId: id,
        message: message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id || "0",
          room: room,
        },
      };

      const messagePayload = api.chatRoom.generateMessagePayload(payload);
      const newPayload = await api.chatRoom.runMiddleware(
        connection,
        messagePayload.room,
        "onSayReceive",
        messagePayload
      );
      const payloadToSend: ChatModule.chatRoom.ChatPubSubMessage = {
        messageType: "chat",
        serverToken: this.config.general.serverToken,
        serverId: id,
        message: newPayload.message,
        sentAt: newPayload.sentAt,
        connection: {
          id: newPayload.from,
          room: newPayload.room,
        },
      };

      await redis.publish(payloadToSend);
    } else {
      throw new Error(this.config.errors.connectionNotInRoom(connection, room));
    }
  }

  generateMessagePayload(message) {
    return {
      message: message.message,
      room: message.connection.room,
      from: message.connection.id,
      context: "user",
      sentAt: message.sentAt,
    } as chatRoom.ChatPubSubMessage;
  }

  incomingMessage(message) {
    const messagePayload = api.chatRoom.generateMessagePayload(message);
    Object.keys(api.connections.connections).forEach((connectionId) => {
      const connection = api.connections.connections[connectionId];
      // we can parallelize this, no need to await
      api.chatRoom.incomingMessagePerConnection(connection, messagePayload);
    });
  }

  async incomingMessagePerConnection(
    connection: Connection,
    messagePayload: ChatModule.chatRoom.ChatPubSubMessage
  ) {
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
  }

  async runMiddleware(
    connection: Connection,
    room: string,
    direction: string,
    messagePayload?: ChatModule.chatRoom.ChatPubSubMessage
  ) {
    let newMessagePayload: ChatModule.chatRoom.ChatPubSubMessage;
    if (messagePayload) {
      newMessagePayload = Object.assign({}, messagePayload);
    }

    for (const name of api.chatRoom.globalMiddleware) {
      const m = api.chatRoom.middleware[name];
      if (typeof m[direction] === "function") {
        if (messagePayload) {
          const data = await m[direction](connection, room, newMessagePayload);
          if (data) {
            newMessagePayload = data;
          }
        } else {
          await m[direction](connection, room);
        }
      }
    }
    return newMessagePayload;
  }
}
