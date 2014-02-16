# Chat

## General

actionhero ships with a chat framework which may be used by all persistent connections (socket and websocket).  There are methods to create chat rooms, and once rooms are created, they can have authentication rules placed on them which will inspect clients as they attempt to join them.

Clients themselves interact with rooms via `verbs`.  Verbs are short-form commands that will attempt to modify the connection's state, either joining or leaving a room.  

Relevant chat verbs are:

- `roomChange`
- `roomLeave`
- `roomView`
- `listenToRoom`
- `silenceRoom`

The special verb for persistent connections `say` makes use of `api.chatRoom.socketRoomBroadcast` to tell a message to all other users in the room, IE: `say Hello World` from a socket client.

Clients can also subscribe to (but not participate in) chatRooms they are not "in" with `listenToRoom ` and `silenceRoom`.  Clients listening to rooms will also be authenticated if needed as they join.

Chat relies on redis connections for both Faye (`api.config.faye`) and a key store defined by `api.config.redis`. Note that if `api.config.redis.fake = true`, you will be using an in-memory redis server rather than a real redis process.  The faye redis store and the key store don't need to be the same instance of redis, but they do need to be the same for all actionhero servers you are running in parallel. 

There is no limit to the number of rooms which can be created, but keep in mind that each room stores information in redis.

## Methods

These methods are to be used within your server (perhaps an action or initializer).  They are not exposed directly to clients.

### `api.chatRoom.socketRoomBroadcast(connection, message, callback)`
- tell a message to all members in a room.
- connection can either be a real connection (A message coming from a client), or a mockConnection.  A mockConnection at the very least has the form `{room: "someOtherRoom}`.  mockConnections without an id will be assigned the id of 0
- The `context` of messages sent with `api.chatRoom.socketRoomBroadcast` always be `user` to differentiate these responses from a `responsee` to a request

### `api.chatRoom.add(room, callback)`
- callback will return 1 if you created the room, 0 if it already existed

### `api.chatRoom.del(room, callback)`
- callback is empty

### `api.chatRoom.exists(room, callback)`
- callback returns (error, found); found is a boolean

### `api.chatRoom.setAuthenticationPattern(room, key, value, callback)`
- callback returns (error)

### `api.chatRoom.roomStatus(room, callback)`
- callback return (error, data)
- data is of the form:

```javascript
{
  room: "myRoom",
  membersCount: 2,
  members: {
    aaa: {id: "aaa", joinedAt: 123456789 },
    bbb: {id: "bbb", joinedAt: 123456789 },
  }
}
```

### `api.chatRoom.addMember(connection, room, callback)`
- callback is of the form (error, wasAdded)

### `api.chatRoom.removeMember(connection, callback)`
- callback is of the form (error, wasRemoved)

### Authentication

When you set a rooms' authentication paten with `api.chatRoom.setAuthenticationPatern`, you are describing a hash which a client needs to match to enter the room.

- `api.chatRoom.setAuthenticationPatern('myRoom', 'type', 'websocket')`` would only allow websocket clients in
- `api.chatRoom.setAuthenticationPatern('myRoom', 'auteneticated', true)`` would only allow clients in which have previously been modified by `connection.authenticated = true; connection._original_connection.authenticated = true;`` probably in an action or middleware.

Clients' authentication is only checked when they first join a room, and not again.

If you delete a room with connections still in it, they will be unable to send any more messages (with a 'room does not exist'-type error), but they will not have `connection.room` reset to null.

### Chatting to specific clients

Every connection object also has a `connection.sendMessage(message)` method which you can call directly from the server.  
