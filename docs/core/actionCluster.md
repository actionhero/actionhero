---
layout: docs
title: Documentation - Action Cluster
---

# Running actionhero in a Cluster

actionhero can be run either as a solitary server or as part of a cluster.  The goal of these cluster helpers is to allow you to create a group of servers which will share state and each be able to handle requests and run tasks.  You can add or remove nodes from the cluster without fear of data loss or task duplication.  You can also run many instances of actionhero on the same server using node.js' cluster methods (`actionhero startCluster`).

## Cache

Using a [redis](http://redis.io/) backend, actionhero nodes share memory objects (using the api.cache methods) and have a common queue for tasks. This means that all peers will have access to all data stored in the cache.  The task system also becomes a common queue which all peers will work on draining.  There should be no changes required to deploy your applicaiton in a cluster.  

Keep in mind that many clients/server can access a cached value simultaneously, so build your actions carefully not to have conflicting state.

## RPC

In version 9.0.0, actionhero introduced RPC.  You can call an RPC to be called on all nodes you may have in your cluster or just a node which holds a specific connection.  You can call RPC methods with the new `api.faye.doCluster` method.  If you provide the optional callback, you will get the first response back (or a timeout error).  RPC calls are invoked with `api.faye.doCluster(method, args, connectionId, callback)`.
  
  For example, if you wanted all nodes to log a message, you would do: `api.faye.doCluster('api.log', ["hello from " + api.id]);`
  
  If you wanted the node which holds connection `abc123` to change their `authorized` status (perhaps because your room authentication relies on this), you would do:

```javascript
api.connections.apply('abc123', 'set', ['auth', true], function(err){
  // do stuff
});
```
The RPC system is used heavily by Chat.

Two options have been added to the `config/faye.js` config file to support this: 

```javascript
// Cluster Transmit Timeout (how long the responding node will delay its response to allow time to catch)
api.config.faye.clusterTransmitTimeout: 100,
// RPC Error Timeout (how long to wait on an RPC call before giving up)
api.config.faye.rpcTimeout: 1000 * 5,

#### WARNING

RPC calls are authenticated against `api.config.serverToken` and communication happens over faye + redis. BE CAREFUL, as you can call *any* method within the API namespace on an actionhero server, including shutdown() and read *any* data on that node. 


## Pub/Sub (Faye)

actionhero also uses [faye](http://faye.jcoglan.com/) to allow for pub/sub communication between nodes.  

You can broadcast and receive messages from other peers in the cluster:

#### api.faye.client.subscribe(channel, callback)
- `channel` is a string of the form "/my/channel"
- `callback` will be passed `message` which is an object

#### api.faye.client.publish(channel, message)
- `channel` is a string of the form "/my/channel"
- `message` is an object

For securty, please keep all internal server-to-server communication broadcasting in a channel under the `"actionhero:*"` namespace.  actionhero has includes an extension that will require all messages sent on this channel to include `{serverToken: api.config.general.serverToken}` as part of their payload.

## Redis Key Reservations

The following keys in redis will be in use by actionhero:

Actionhero's core will create keys under the `actionhero` namespace (ie: `actionhero:cache`, `actionhero:stats`, etc).  This is configurable.
Faye will also make use of a large number of keys, but under the `faye` namespace (configurable prefix)
Tasks will also make use of a large number of keys, but under the `resque` namespace (configurable prefix)
