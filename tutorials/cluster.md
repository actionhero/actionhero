![](cluster-ready.svg)

## Overview

**_AKA: Running ActionHero in a Cluster_**

ActionHero can be run either as a solitary server or as part of a cluster. The goal of these cluster helpers is to allow you to create a group of servers which will share state and each be able to handle requests and run tasks. You can add or remove nodes from the cluster without fear of data loss or task duplication. You can also run many instances of ActionHero on the same server using node.js cluster methods (`actionhero start cluster`), which you [can learn more about here](tutorial-production-notes.html).

Cluster instances are named sequentially, starting with `actionhero-worker-1`, and can be retrieved from 'api.id'. Logs and PID's, as well as other instance-specific information follow this pattern as well.


## Cache

Using a [redis](http://redis.io) backend, ActionHero nodes share memory objects (using the `api.cache methods`) and have a common queue for tasks. This means that all peers will have access to all data stored in the cache. The task system also becomes a common queue which all peers will work on draining. There should be no changes required to deploy your application in a cluster.

Keep in mind that many clients/server can access a cached value simultaneously, so build your actions carefully not to have conflicting state. You can [learn more about the cache methods here](api.cache.html). You can also [review recommendations about Production Redis configurations](tutorial-production-notes.html).

## RPC

In version 9.0.0, ActionHero introduced Remote Procedure Calls, or RPC for short. You can call an RPC method to be executed on all nodes in your cluster or just a node which holds a specific connection. You can call RPC methods with the `api.redis.doCluster` method. If you provide the optional callback, you will get the first response back (or a timeout error). RPC calls are invoked with `api.redis.doCluster(method, args, connectionId, waitForResponse)`.

For example, if you wanted all nodes to log a message, you would do: `api.redis.doCluster('api.log', ["hello from " + api.id])`

If you wanted the node which holds connection `abc123` to change their `authorized` status (perhaps because your room authentication relies on this), you would do:

```js
// This will ask all nodes connected to the cluster if they have connection #\`abc123\`
//   and if they do, run \`connection.set('auth', true)\` on it
await api.connections.apply('abc123', 'set', ['auth', true]);
```

The RPC system is used heavily by Chat.

Two options have been added to the `config/redis.js` config file to support this: `api.config.general.channel` ( Which channel to use on redis pub/sub for RPC communication ) and `api.config.general.rpcTimeout` ( How long to wait for an RPC call before considering it a failure )

**WARNING**

RPC calls are authenticated against `api.config.serverToken` and communication happens over redis pub/sub. BE CAREFUL, as you can call _any_ method within the API namespace on an ActionHero server, including shutdown() and read _any_ data on that node.

## Connections

Some special RPC tools have been added so that you can interact with connections across multiple nodes. Specifically the chat sub-system needs to be able to boot and move connections into rooms, regardless of which node they are connected to.

ActionHero has exposed `api.connections.apply` which can be used to retrieve data about and modify a connection on any node.

### `api.connections.apply(connectionId, method, args)`

*   [Learn More](api.connections.html)
*   connectionId is required
*   Both `method` and `args` can be ignored if you just want to retrieve information about a connection, IE: `const connectionDetails = await api.connections.apply(connectionId)`

## PubSub

```js
// To subscribe to messages, add a callback for your \`messageType\`, IE:
api.redis.subscriptionHandlers['myMessageType'] = function(message){
  // do stuff
}

// send a message
const payload = {
  messageType: 'myMessageType',
  serverId: api.id,
  serverToken: api.config.general.serverToken,
  message: 'hello!',
}

await api.redis.publish(payload)
```

ActionHero also uses redis to allow for pub/sub communication between nodes.

You can broadcast and receive messages from other peers in the cluster:

### `api.redis.publish(payload)`

*   [Learn More](api.redis.html)
*   payload must contain:
    *   `messageType` : the name of your payload type,
    *   `serverId` : `api.id`,
    *   `serverToken` : `api.config.general.serverToken`,
