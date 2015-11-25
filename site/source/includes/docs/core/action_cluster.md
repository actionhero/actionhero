
# ActionCluster
*AKA: Running actionhero in a Cluster*

actionhero can be run either as a solitary server or as part of a cluster.  The goal of these cluster helpers is to allow you to create a group of servers which will share state and each be able to handle requests and run tasks.  You can add or remove nodes from the cluster without fear of data loss or task duplication.  You can also run many instances of actionhero on the same server using node.js' cluster methods (`actionhero startCluster`), which you [can learn more about here](/docs#production-notes).

## Cache

Using a [redis](http://redis.io/) backend, actionhero nodes share memory objects (using the `api.cache methods`) and have a common queue for tasks. This means that all peers will have access to all data stored in the cache.  The task system also becomes a common queue which all peers will work on draining.  There should be no changes required to deploy your applicaiton in a cluster.  

Keep in mind that many clients/server can access a cached value simultaneously, so build your actions carefully not to have conflicting state.  You can [learn more about the cache methods here](/docs#general-cache-notes)

## RPC

```javascript
// This will ask all nodes connected to the cluster if they have connection #`abc123` and if they do, run `connection.set('auth', true) on it`
api.connections.apply('abc123', 'set', ['auth', true], function(err){
  // do stuff
});
```

In version 9.0.0, actionhero introduced Remote Procedure Calls, or RPC for short.  You can call an RPC method to be excecuted on all nodes in your cluster or just a node which holds a specific connection.  You can call RPC methods with the `api.redis.doCluster` method.  If you provide the optional callback, you will get the first response back (or a timeout error).  RPC calls are invoked with `api.redis.doCluster(method, args, connectionId, callback)`.
  
For example, if you wanted all nodes to log a message, you would do: `api.redis.doCluster('api.log', ["hello from " + api.id]);`

If you wanted the node which holds connection `abc123` to change their `authorized` status (perhaps because your room authentication relies on this), you would do:

The RPC system is used heavily by Chat.

Two options have been added to the `config/redis.js` config file to support this: `api.config.redis.channel` ( Which channel to use on redis pub/sub for RPC communication ) and `api.config.redis.rpcTimeout` ( How long to wait for an RPC call before considering it a failure )

**WARNING**

RPC calls are authenticated against `api.config.serverToken` and communication happens over redis pub/sub. BE CAREFUL, as you can call *any* method within the API namespace on an actionhero server, including shutdown() and read *any* data on that node. 

### Connections

Some special RPC tools have been added so that you can interact with connections across multiple nodes.  Speficially the chat sub-system needs to be able to boot and move connections into rooms, regardless of which node they are connected to.

actionhero has exposed `api.connections.apply` which can be used to retrive data about and modify a connection on any node.

### api.connections.apply(connectionId, method, args, callback)
- connectionId is required
- if `method` and `args` can be ignored if you just want to retirve information abou a connection, IE: `api.connections.apply(connectionId, callback)`
- `callback` is of the form `function(err, connectionDetails)`

## Generic Pub/Sub

```javascript
// To subscirbe to messages, add a callback for your `messageType`, IE:
api.redis.subscriptionHandlers['myMessageType'] = function(message){
  // do stuff
}

// send a message
var payload = {
  messageType: 'myMessageType',
  serverId: api.id,
  serverToken: api.config.general.serverToken,
  message: 'hello!',
}
api.redis.publish(payload)
```

actionhero also uses redis to allow for pub/sub communication between nodes.  

You can broadcast and receive messages from other peers in the cluster:

### api.redis.publish(payload)
- paylaod must contain:
  - `messageType`  : '{the name of your payload type}',
  - `serverId`     : api.id,
  - `serverToken`  : api.config.general.serverToken,
