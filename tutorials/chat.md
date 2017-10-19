![](chat.svg)

## General

ActionHero ships with a chat framework which may be used by all persistent connections (`socket` and `websocket`). There are methods to create and manage chat rooms and control the users in those rooms. Chat does not have to be for peer-to-peer communication, and is a metaphor used for many things, including the sharing of all realtime data between client and server, and client to client.  This can be used for games, syndication, etc.

Clients themselves interact with rooms via `verbs`. Verbs are short-form commands that will attempt to modify the connection's state, either joining or leaving a room. Clients can be in many rooms at once.

Relevant chat verbs are:

*   `roomAdd`
*   `roomLeave`
*   `roomView`
*   `say`

The special verb for persistent connections `say` makes use of `api.chatRoom.broadcast` to tell a message to all other users in the room, IE: `say myRoom Hello World` from a socket client or `client.say("myRoom", 'Hello World")` for a websocket.

Chat on multiple actionHero nodes relies on redis for both chat (pub/sub) and a key store defined by `api.config.redis`. The redis pub/sub server and the key store don't need to be the same instance of redis, but they do need to be the same for all ActionHero servers you are running in the cluster. This is how ActionHero scales the chat features.

There is no limit to the number of rooms which can be created, but keep in mind that each room stores information in redis, and there load created for each connection.

## Middleware

There are 4 types of middleware you can install for the chat system: `say`, `onSayReceive`, `join`, and `leave`. You can learn more about [chat middleware in the middleware section of this site](tutorial-middleware.html).  Using middleware when messages are sent or when connections join rooms is how you build up authentication and more complex workflows.

## Specific Client Communication

Every connection object also has a `connection.sendMessage(message)` method which you can call directly from the server.

## Client Use

The details of communicating within a chat room are up to each individual server (see [websocket](tutorial-websocket-server.html) or [socket](tutorial-socket-server.html)), but the same principals apply:

*   Client will join a room (`client.roomAdd(room)`).
*   Once in the room, clients can send messages (which are strings) to everyone else in the room via `say`, ie: `{`client.say('room', Hello World')`}`
*   Once a client is in a room, they will revive messages from other members of the room as events. For example, catching say events from the websocket client looks like `{`client.on('say', function(message){ console.log(message); })`}`. You can inspect `message.room` if you are in more than one room.
    *   The payload of a message will contain the room, sender, and the message body: `{`{message: "Hello World", room: "SecretRoom", from: "7d419af9-accf-40ac-8d78-9281591dd59e", context: "user", sentAt: 1399437579346}`}`

If you want to create an authenticated room, there are 2 steps:

*   First, create an action which modifies some property either on the connection object it self, or stores permissions to a database.
*   Then, create a `join`-style middleware which checks these values.  In this middleware, you can determine if the connection should be added to the room or not.
