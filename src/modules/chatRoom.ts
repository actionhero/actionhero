import { api, config, id, redis, Connection } from "./../index";
import * as RedisModule from "../modules/redis";

export namespace chatRoom {
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
    /**Called when a connection is about to receive a say message. */
    say?: Function;
  }

  export interface ChatPubSubMessage extends RedisModule.redis.PubSubMessage {
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

  /**
   * Add a middleware component to connection handling.
   */
  export async function addMiddleware(data: ChatMiddleware) {
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
  }

  /**
   * List all chat rooms created
   */
  export async function list(): Promise<Array<string>> {
    return api.redis.clients.client.smembers(api.chatRoom.keys.rooms);
  }

  /**
   * Add a new chat room.  Throws an error if the room already exists.
   */
  export async function add(room: string) {
    const found = await chatRoom.exists(room);
    if (found === false) {
      return api.redis.clients.client.sadd(api.chatRoom.keys.rooms, room);
    } else {
      throw new Error(await config.errors.connectionRoomExists(room));
    }
  }

  /**
   * Remove an existing chat room.  All connections in the room will be removed.  Throws an error if the room does not exist.
   */
  export async function destroy(room: string) {
    const found = await chatRoom.exists(room);
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
        await chatRoom.removeMember(id, room, false);
      }

      await api.redis.clients.client.srem(api.chatRoom.keys.rooms, room);
      await api.redis.clients.client.del(api.chatRoom.keys.members + room);
    } else {
      throw new Error(await config.errors.connectionRoomNotExist(room));
    }
  }

  /**
   * Check if a room exists.
   */
  export async function exists(room: string): Promise<boolean> {
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
  }

  /**
   * Configures what properties of connections in a room to return via `api.chatRoom.roomStatus`
   */
  export async function sanitizeMemberDetails(memberData) {
    return {
      id: memberData.id,
      joinedAt: memberData.joinedAt
    };
  }

  /**
   * Learn about the connections in the room.
   * Returns a hash of the form { room: room, members: cleanedMembers, membersCount: count }.  Members is an array of connections in the room sanitized via `api.chatRoom.sanitizeMemberDetails`
   */
  export async function roomStatus(
    room: string
  ): Promise<{ [key: string]: any }> {
    if (room) {
      const found = await chatRoom.exists(room);
      if (found === true) {
        const key = api.chatRoom.keys.members + room;
        const members = (await api.redis.clients.client.hgetall(key)) as {
          [key: string]: string;
        };
        const cleanedMembers = {};
        let count = 0;

        for (const id in members) {
          const data = JSON.parse(members[id]);
          cleanedMembers[id] = chatRoom.sanitizeMemberDetails(data);
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
  }

  /**
   * An overwrite-able method which configures what properties of connections in a room are initially stored about a connection when added via `api.chatRoom.addMember`
   */
  export async function generateMemberDetails(connection: Connection) {
    return {
      id: connection.id,
      joinedAt: new Date().getTime(),
      host: id
    };
  }

  /**
   * Add a connection (via id) to a room.  Throws errors if the room does not exist, or the connection is already in the room.  Middleware errors also throw.
   */
  export async function addMember(
    connectionId: string,
    room: string
  ): Promise<any> {
    const connection = api.connections.connections[connectionId];
    if (!connection) {
      return redis.doCluster(
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
      const found = await chatRoom.exists(room);
      if (!found) {
        throw new Error(await config.errors.connectionRoomNotExist(room));
      }
    }

    if (connection.rooms.indexOf(room) < 0) {
      await api.chatRoom.runMiddleware(connection, room, "join");
    }

    if (connection.rooms.indexOf(room) < 0) {
      const memberDetails = chatRoom.generateMemberDetails(connection);
      connection.rooms.push(room);
      await api.redis.clients.client.hset(
        api.chatRoom.keys.members + room,
        connection.id,
        JSON.stringify(memberDetails)
      );
    }

    return true;
  }

  /**
   * Remote a connection (via id) from a room.  Throws errors if the room does not exist, or the connection is not in the room.  Middleware errors also throw.
   * toWaitRemote: Should this method wait until the remote ActionHero server (the one the connection is connected too) responds?
   */
  export async function removeMember(
    connectionId: string,
    room: string,
    toWaitRemote: boolean = true
  ): Promise<any> {
    const connection = api.connections.connections[connectionId];
    if (!connection) {
      return redis.doCluster(
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
      const found = await chatRoom.exists(room);
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
  }
}
