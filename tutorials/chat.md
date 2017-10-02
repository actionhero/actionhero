## General

ActionHero ships with a chat framework which may be used by all persistent connections (`socket` and `websocket`). There are methods to create and manage chat rooms and control the users in those rooms. Chat does not have to be for peer-to-peer communication, and is a metaphor used for many things, including game state in MMOs.

Clients themselves interact with rooms via `verbs`. Verbs are short-form commands that will attempt to modify the connection's state, either joining or leaving a room. Clients can be in many rooms at once.

Relevant chat verbs are:

*   `roomAdd`
*   `roomLeave`
*   `roomView`
*   `say`

The special verb for persistent connections `say` makes use of `api.chatRoom.broadcast` to tell a message to all other users in the room, IE: `say myRoom Hello World` from a socket client or `client.say("myRoom", 'Hello World")` for a websocket.

Chat on multiple actionHero nodes relies on redis for both chat (pub/sub) and a key store defined by `api.config.redis`. Note that if you elect to use fakeredis, you will be using an in-memory redis server rather than a real redis process, which does not work to share data across nodes. The redis store and the key store don't need to be the same instance of redis, but they do need to be the same for all ActionHero servers you are running in parallel. This is how ActionHero scales the chat features.

There is no limit to the number of rooms which can be created, but keep in mind that each room stores information in redis, and there load created for each connection.

## Middleware

There are 4 types of middleware you can install for the chat system: `say`, `onSayReceive`, `join`, and `leave`. You can learn more about [chat middleware in the middleware section of this site](/docs/core/middleware)

## Specific Clients

Every connection object also has a `connection.sendMessage(message)` method which you can call directly from the server.

## Client Use

The details of communicating within a chat room are up to each individual server (see [websocket](/docs/servers/websocket) or [socket](/docs/servers/socket)), but the same principals apply:

*   Client will join a room (`client.roomAdd(room)`).
*   Once in the room, clients can send messages (which are strings) to everyone else in the room via `say`, ie: `{`client.say('room', Hello World')`}`
*   Once a client is in a room, they will revive messages from other members of the room as events. For example, catching say events from the websocket client looks like `{`client.on('say', function(message){ console.log(message); })`}`. You can inspect `message.room` if you are in more than one room.
    *   The payload of a message will contain the room, sender, and the message body: `{`{message: "Hello World", room: "SecretRoom", from: "7d419af9-accf-40ac-8d78-9281591dd59e", context: "user", sentAt: 1399437579346}`}`

If you want to create an authenticated room, there are 2 steps:

*   First, create an action which modifies some property eitehr on the connection object it self, or stores permissions to a database.
*   Then, create a `joinCallback`-style middleware which cheks these values.