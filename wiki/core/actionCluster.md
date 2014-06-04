---
layout: wiki
title: Wiki - Action Cluster
---

# Running actionhero in a Cluster

actionhero can be run either as a solitary server or as part of a cluster.  The goal of these cluster helpers is to allow you to create a group of servers which will share state and each be able to handle requests and run tasks.  You can add or remove nodes from the cluster without fear of data loss or task duplication.  You can also run many instances of actionhero on the same server using node.js' cluster methods (`actionhero startCluster`).

## Cache

Using a [redis](http://redis.io/) backend, actionhero nodes share memory objects (using the api.cache methods) and have a common queue for tasks. This means that all peers will have access to all data stored in the cache.  The task system also becomes a common queue which all peers will work on draining.  There should be no changes required to deploy your applicaiton in a cluster.  

Keep in mind that many clients/server can access a cached value simultaneously, so build your actions carefully not to have conflicting state.

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

- `actionhero:cache` (array) the common shared cache object
- `actionhero:stats` (array) the common shared stats object
- `actionhero:roomMembers-{roomName}` (array) a list of the folks in a given socket room

Faye will also make use of a large number of keys, but under the "faye" namespace (configurable prefix)

Tasks will also make use of a large number of keys, but under the "resque" namespace (configurable prefix)
