import { api, config, id, log, chatRoom, redis, Initializer } from "../index";
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
  incomingMessagePerConnection?: ChatRoomInitializer["incomingMessagePerConnection"];
  runMiddleware?: ChatRoomInitializer["runMiddleware"];
}

export type ChatMiddlewareDirections =
  | "join"
  | "leave"
  | "onSayReceive"
  | "say";

export type MessagePayloadType = ReturnType<
  typeof api.chatRoom.generateMessagePayload
>;

/**
 * Chat & Realtime Communication Methods
 */
export class ChatRoomInitializer extends Initializer {
  constructor() {
    super();
    this.name = "chatRoom";
    this.loadPriority = 520;
    this.startPriority = 200;
  }

  broadcast = async (
    connection: Connection | {},
    room: string,
    message: object | Array<any> | string
  ) => {
    if (!room || !message) {
      throw new Error(config.errors.connectionRoomAndMessage(connection));
    } else if (
      connection instanceof Connection &&
      (connection.rooms === undefined || connection.rooms.indexOf(room) > -1)
    ) {
      const payload: ChatModule.chatRoom.ChatPubSubMessage = {
        messageType: "chat",
        serverToken: config.general.serverToken,
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
        serverToken: config.general.serverToken,
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
      throw new Error(config.errors.connectionNotInRoom(connection, room));
    }
  };

  generateMessagePayload = (message: chatRoom.ChatPubSubMessage) => {
    return {
      message: message.message,
      room: message.connection.room,
      from: message.connection.id,
      context: "user",
      sentAt: message.sentAt,
    };
  };

  incomingMessage = (message: ChatModule.chatRoom.ChatPubSubMessage) => {
    const messagePayload = api.chatRoom.generateMessagePayload(message);
    Object.keys(api.connections.connections).forEach((connectionId) => {
      const connection = api.connections.connections[connectionId];
      // we can parallelize this, no need to await
      api.chatRoom.incomingMessagePerConnection(connection, messagePayload);
    });
  };

  incomingMessagePerConnection = async (
    connection: Connection,
    messagePayload: MessagePayloadType
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

  runMiddleware = async (
    connection: Connection,
    room: string,
    direction: ChatMiddlewareDirections,
    messagePayload?: MessagePayloadType
  ) => {
    let newMessagePayload: MessagePayloadType;
    if (messagePayload) newMessagePayload = Object.assign({}, messagePayload);

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
  };

  async initialize() {
    api.chatRoom = {
      middleware: {},
      globalMiddleware: [],
      messageChannel: "/actionhero/chat/chat",
      keys: {
        rooms: "actionhero:chatRoom:rooms",
        members: "actionhero:chatRoom:members:",
      },
      broadcast: this.broadcast,
      generateMessagePayload: this.generateMessagePayload,
      incomingMessage: this.incomingMessage,
      incomingMessagePerConnection: this.incomingMessagePerConnection,
      runMiddleware: this.runMiddleware,
    };
  }

  async start() {
    api.redis.subscriptionHandlers.chat = (
      message: ChatModule.chatRoom.ChatPubSubMessage
    ) => {
      if (api.chatRoom) {
        api.chatRoom.incomingMessage(message);
      }
    };

    for (const [room, options] of Object.keys(
      config.genera.startingChatRooms
    )) {
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
