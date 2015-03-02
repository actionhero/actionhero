---
layout: docs
title: Documentation - Stats
---

# Stats

actionhero ships with stats backend (in redis) to store and retrieve metrics about the server, connectons, the cluster, and your application.

Many of the core actionhero features (cache, web/tcp/websocket servers, etc) are instrumented with stats, but you are encouraged to add more!

In order to maintain high performance, actionhero will buffer stats changes locally, and only write them to redis at a frequency defined in `api.config.stats.writeFrequency`.

The Stats redis server is defined by `api.config.redis`. Note that if `api.config.redis.fake = true`, you will be using an in-memory redis server rather than a real redis process.

### api.stats.increment(key, count)
- key is a string of the form ("thing:stuff")
- count is a signed integer

### api.stats.get(key, collection, next)
- next(err, data)
- key is a string of the form ("thing:stuff")
- collection (optional) is one of the collections used for stats set in `api.config.stats.keys`

### api.stats.getAll(collections, next)
- next(err, stats)
- collections (optional) is an array of one or more of the keys used for stats set in `api.config.stats.keys`
- stats is a hash of `{key1: stats {}, key2: stats {} }`
- keys will be collapsed into a hash 

## Notes
- in `api.stats.increment`, the count can be negative or positive
- `api.config.stats.writeFrequency` is how often the local stats buffer is written to redis.  Faster frequencies will keep your stats up to date faster, but slow down the rest of your server due to constant writes to redis.
- You can configure actionhero to store stats changes to more than one redis hash.  You might wish to do this so that you may keep 'local' stats and 'global' stats.  For example, if you set `api.config.stats.keys = ['actionhero:stats', process.pid + ':stats']`.  All servers in your cluster will contribute to `actionhero:stats` and just this server's information will be logged in `process.pid + ':stats'`
  
## Example: 

{% highlight javascript %} 
api.stats.increment('myCount', 2);
api.stats.increment('myCount', 3);
api.stats.increment('myCount', -1);

// after waiting enough time for the stats to write to redis

api.stats.get('myCount', function(err, count){
	console.log(count)); // count => 4
});
{% endhighlight %}