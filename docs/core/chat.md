---
layout: docs
title: Documentation - Chat
---

# Chat

## General

actionhero ships with a chat framework which may be used by all persistent connections (socket and websocket).  There are methods to create chat rooms, and once rooms are created, they can have authentication rules placed on them which will inspect clients as they attempt to join them.  Chat does not have to be for peer-to-peer communication, and is a metaphor used for many things, including game state in MMOs.

Clients themselves interact with rooms via `verbs`.  Verbs are short-form commands that will attempt to modify the connection's state, either joining or leaving a room.  Clients can be in many rooms at once.

Relevant chat verbs are:

- `roomAdd`
- `roomLeave`
- `roomView`

The special verb for persistent connections `say` makes use of `api.chatRoom.broadcast` to tell a message to all other users in the room, IE: `say myRoom Hello World` from a socket client or `client.say("myRoom", 'Hello World")` for a websocket..

Chat on multiple actionHero nodes relies on redis for both chat (pub/sub) and a key store defined by `api.config.redis`. Note that if `api.config.redis.fake = true`, you will be using an in-memory redis server rather than a real redis process, which does not work to share data across nodes.  The redis store and the key store don't need to be the same instance of redis, but they do need to be the same for all actionhero servers you are running in parallel. 

There is no limit to the number of rooms which can be created, but keep in mind that each room stores information in redis, and is load on the clients connected to it.

## Methods

These methods are to be used within your server (perhaps an action or initializer).  They are not exposed directly to clients, but they can be within an action.

### api.chatRoom.broadcast(connection, room, message, callback)
- tell a message to all members in a room.
- connection can either be a real connection (A message coming from a client), or a mockConnection.  A mockConnection at the very least has the form `{room: "someOtherRoom}`.  mockConnections without an id will be assigned the id of 0
- The `context` of messages sent with `api.chatRoom.broadcast` always be `user` to differentiate these responses from a `responsee` to a request

### api.chatRoom.add(room, callback)
- callback will return 1 if you created the room, 0 if it already existed

### api.chatRoom.destroy(room, callback)
- callback is empty

### api.chatRoom.exists(room, callback)
- callback returns (error, found); found is a boolean

### api.chatRoom.roomStatus(room, callback)
- callback returns (error, details); details is a hash containing room information

### api.chatRoom.setAuthenticationPattern(room, key, value, callback)
- callback returns (error)

### api.chatRoom.roomStatus(room, callback)
- callback return (error, data)
- data is of the form:

{% highlight javascript %}
{
  room: "myRoom",
  membersCount: 2,
  members: {
    aaa: {id: "aaa", joinedAt: 123456789 },
    bbb: {id: "bbb", joinedAt: 123456789 },
  }
}
{% endhighlight %}

### api.chatRoom.authorize(connection, room, callback)
- callback is of the form (error, authorized), which is `true` or `false`

### api.chatRoom.reAuthenticate(connectionId, callback)
- callback contains an array of rooms the connection is still in and rooms the connection was removed from
- you can check on connections from this or any other server in the cluster

### api.chatRoom.addMember(connectionId, room, callback)
- callback is of the form (error, wasAdded)
- you can add connections from this or any other server in the cluster

### api.chatRoom.removeMember(connectionId, room, callback)
- callback is of the form (error, wasRemoved)
- you can remove connections from this or any other server in the cluster

## Middleware

As we do not want to block the ability for a connection to join a room (we already have authentication tools in place), Chat Middleare does not have a callback and is executed "in parallel" to the connection actually joining the room.  This middleware can be used for announcing members joining and leaving to other members in the chat room or logging stats.

Use `api.chatRoom.addJoinCallback(function(connection, room), priority)` to add a Join Callback, and use `api.chatRoom.addLeaveCallback(function(connection, room), priority)` to handle connections leaving a room. 

You can optionally provide a `priority` to control the order of operations in the middleware.

You can announce to everyone else in the room when a connection joins and leaves:
{% highlight javascript %}
api.chatRoom.addJoinCallback(function(connection, room){
  api.chatRoom.broadcast(connection, room, 'I have entered the room');
});

api.chatRoom.addLeaveCallback(function(connection, room){
  api.chatRoom.broadcast(connection, room, 'I have left the room');
});
{% endhighlight %}

## Authentication

When you set a rooms' authentication paten with `api.chatRoom.setAuthenticationPatern`, you are describing a hash which a client needs to match to enter the room.

- `api.chatRoom.setAuthenticationPatern('myRoom', 'type', 'websocket')` would only allow websocket clients in
- `api.chatRoom.setAuthenticationPatern('myRoom', 'auteneticated', true)` would only allow clients in which have previously been modified by `connection.authenticated = true; connection._originalConnection.authenticated = true;` probably in an action or middleware.

Clients' authentication is re-checked when you make a change, and when they join the room.

If you delete a room with connections still in it, clients will be notified and kicked out.

## Chatting to specific clients

Every connection object also has a `connection.sendMessage(message)` method which you can call directly from the server.  

## Client Use

The details of communicating within a chat room are up to each individual server (see [websocket](/docs/servers/websocket.html) or [socket](/docs/servers/socket.html)), but the same principals apply:

- Client will join a room (`client.roomAdd(room)`).
- Once in the room, clients can send messages (which are strings) to everyone else in the room via `say`, ie: `client.say('room', Hello World')`
- Once a client is in a room, they will revive messages from other members of the room as events.  For example, catching say events from the websocket client looks like `client.on('say', function(message){ console.log(message); })`.  You can inspect `message.room` if you are in more than one room.
  - The payload of a message will contain the room, sender, and the message body: `{message: "Hello World", room: "SecretRoom", from: "7d419af9-accf-40ac-8d78-9281591dd59e", context: "user", sentAt: 1399437579346} `

The flow for an authenticated rooom is: 

- Only the server(s) can create rooms with `api.chatRoom.add('secretRoom')`
- Once a room is created, you can then set an authentication rule for clients joining it: `api.chatRoom.setAuthenticationPattern('secretRoom','authenticated', true)`
  - This means that every `connection` which attempts to join this room, actionhero will check that `connection.authenticated == true` before allowing them in.
- `connection`s can only modify their `connection.params` hash, which means that only the sever can ever modify `connection.authenticated`, which makes it a safe key for authentication.
- In your authentication (login) action, you can set that authentication bit, ie: `connection.authenticated = true; connection._originalConnection.authenticated = true; `. 
- You can get more elaborate with this kind of thing.  Perhaps you only want each user to be allowed in one room at all.  Then do something like `api.chatRoom.setAuthenticationPattern('secretRoom','authorizedRoom','secretRoom')`. 
