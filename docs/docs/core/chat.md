---
layout: docs
title: Documentation - Chat
---

# Chat

## General

actionhero ships with a chat framework which may be used by all persistent connections (socket and websocket).  There are methods to create and manage chat rooms and control the users in those rooms.  Chat does not have to be for peer-to-peer communication, and is a metaphor used for many things, including game state in MMOs.

Clients themselves interact with rooms via `verbs`.  Verbs are short-form commands that will attempt to modify the connection's state, either joining or leaving a room.  Clients can be in many rooms at once.

Relevant chat verbs are:

- `roomAdd`
- `roomLeave`
- `roomView`
- `say`

The special verb for persistent connections `say` makes use of `api.chatRoom.broadcast` to tell a message to all other users in the room, IE: `say myRoom Hello World` from a socket client or `client.say("myRoom", 'Hello World")` for a websocket.

Chat on multiple actionHero nodes relies on redis for both chat (pub/sub) and a key store defined by `api.config.redis`. Note that if `api.config.redis.fake = true`, you will be using an in-memory redis server rather than a real redis process, which does not work to share data across nodes.  The redis store and the key store don't need to be the same instance of redis, but they do need to be the same for all actionhero servers you are running in parallel.  This is how actionhero scales the chat features.

There is no limit to the number of rooms which can be created, but keep in mind that each room stores information in redis, and there load created for each connection.

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
- details of the form:

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

### api.chatRoom.addMember(connectionId, room, callback)
- callback is of the form (error, wasAdded)
- you can add connections from this or any other server in the cluster

### api.chatRoom.removeMember(connectionId, room, callback)
- callback is of the form (error, wasRemoved)
- you can remove connections from this or any other server in the cluster

### api.chatRoom.generateMemberDetails( connection )
- defines what is stored from the connection object in the member data
- default is `id: connection.id`
- other data that is stored by default is `host: api.id` and `joinedAt: new Date().getTime()`
- override the entire method to store custom data *that is on the connection*

### api.chatRoom.sanitizeMemberDetails( memberData )
- Defines what is pulled out of the member data when returning roomStatus
- Defaults to `joinedAt : memberData.joinedAt`
- After method call, always filled with `id`, based on the `connection.id` used to store the data
- Override the entire method to use custom data as defined in `api.chatRoom.generateMemberDetails`

### api.chatRoom.generateMessagePayload( message )
- Defiens how messages from clients are sanitized
- Override the entire method to use custom data as defined in `api.chatRoom.generateMessagePayload`

## Middleware

There are 4 types of middelware you can install for the chat system: `say`, `onSayReceive`, `join`, and `leave`.  All chat callbacks process serially and require a callback.  This means that you can use a number of middleware to control things like room authentication and message logging/parsing. This is a signifigant change from earlier versions of actionhero.

### Methods
The 4 middleware controll methods are:

{% highlight javascript %}
var chatMiddleware = {
  name: 'chat middleware',
  priority: 1000,
  join: function(connection, room, callback){
    // announce all connections entering a room
    api.chatRoom.broadcast({}, room, 'I have joined the room: ' + connection.id, function(e){
      callback(null);
    });
  },
  leave: function(connection, room, callback){
    // announce all connections leaving a room
    api.chatRoom.broadcast({}, room, 'I have left the room: ' + connection.id, function(e){
      callback(null);
    });
  },
  /**
   * Will be executed once per client connection before delivering the message.
   */
  say: function(connection, room, messagePayload, callback){
    // do stuff
    api.log(messagePayload);
    callback(null, messagePayload);
  },
  /**
   * Will be executed only once, when the message is sent to the server.
   */
  onSayReceive: function(connection, room, messagePayload, callback){
    // do stuff
    api.log(messagePayload);
    callback(null, messagePayload);
  }
};

api.chatRoom.addMiddleware(chatMiddleware);
{% endhighlight %}

### Notes
- In the example above, I want to announce the member joining the room, but he has not yet been added to the room, as the callback chain is still firing.  If the connection itself were to make the broadcast, it would fail because the connection is not in the room.  Instead, an empty `{}` connection is used to proxy the message coming from the 'system'
- Only the `sayCallbacks` have a second return value on the callback, `messagePayload`.  This allows you to modify the message being sent to your clients. 
- `messagePayload` will be modified and and passed on to all `addSayCallback` middlewares inline, so you can append and modify it as you go
- If you have a number of callbacks (`say`, `onSayReceive`, `join` or  `leave`), the priority maters, and you can block subsequent methods from firing by returning an error to the callback.
- `sayCallbacks` are executed once per client connection. This makes it suitable for customizing the message based on the individual client.
- `onSayReceiveCallbacks` are executed only once, when the message is sent to the server.

{% highlight javascript %}
// in this example no one will be able to join any room, and the `say` callback will never be invoked.

api.chatRoom.addMiddleware({
  name: 'blocking chat middleware',
  join: function(connection, room, callback){
    callback(new Error('blocked from joining the room'));
  }),
  say: function(connection, room, messagePayload, callback){
    api.chatRoom.broadcast({}, room, 'I have entered the room: ' + connection.id, function(e){
      callback();
    });
  },
});
{% endhighlight %}

If a `say` is blocked/errored, the message will simply not be delivered to the client.  If a  `join` or  `leave` is blocked/errored, the verb or method used to invoke the call will be returned that error.

## Chatting to specific clients

Every connection object also has a `connection.sendMessage(message)` method which you can call directly from the server.  

## Client Use

The details of communicating within a chat room are up to each individual server (see [websocket](/docs/servers/websocket.html) or [socket](/docs/servers/socket.html)), but the same principals apply:

- Client will join a room (`client.roomAdd(room)`).
- Once in the room, clients can send messages (which are strings) to everyone else in the room via `say`, ie: `client.say('room', Hello World')`
- Once a client is in a room, they will revive messages from other members of the room as events.  For example, catching say events from the websocket client looks like `client.on('say', function(message){ console.log(message); })`.  You can inspect `message.room` if you are in more than one room.
  - The payload of a message will contain the room, sender, and the message body: `{message: "Hello World", room: "SecretRoom", from: "7d419af9-accf-40ac-8d78-9281591dd59e", context: "user", sentAt: 1399437579346} `

If you want to create an authenticated room, there are 2 steps:

- First, create an action which modifies some property eitehr on the connection object it self, or stores permissions to a database.
- Then, create a `joinCallback`-style middleware which cheks these values.
