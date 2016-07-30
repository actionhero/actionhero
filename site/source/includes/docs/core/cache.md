# Cache

## General Cache Notes

ActionHero ships with the functions needed for a distributed key-value cache.  You can cache strings, numbers, arrays and objects (anything that responds to `JSON.stringify`).  

The cache's redis server is defined by `api.config.redis`.  It is possible to use fakeredis.

## Cache Methods

### api.cache.save

* Invoke: `api.cache.save(key, value, expireTimeMS, next)`
	* `expireTimeMS` can be null if you never want the object to expire
* Callback: `next(error, newObject)`
	* `error` will be null unless the object can't be saved (perhaps out of ram or a bad object type).
	* overwriting an existing object will return `newObject = true`

`api.cache.save` is used to both create new entires or update existing cache entires.  If you don't define an expireTimeMS, `null` will be assumed, and using `null` will cause this cached item to never expire.  Expired cache objects will be periodically swept away (but not necessarily exactly when they expire)

### api.cache.load

* Invoke: `api.cache.load(key, next)` or `api.cache.load(key, options, next)`
	* `options` can be `{expireTimeMS: 1234}` where the act of reading the key will reset the key's expire time
	* If the requested `key` is not found (or is expired), all values returned will be null.
* Callback: `next(error, value, expireTimestamp, createdAt, readAt)`
	* `value` will be the object which was saved and `null` if the object cannot be found or is expired
	* `expireTimestamp` (ms) is when the object is set to expire in system time
	* `createdAt` (ms) is when the object was created
	* `readAt` (ms) is the timestamp at which the object was last read with `api.cache.load`.  Useful for telling if another worker has consumed the object recently

### api.cache.destroy
* Invoke: `api.cache.destroy(key)`
* Callback: `next(error, destroyed)`
  * will be false if the object cannot be found, and true if destroyed

## List methods

`api.cache` implements a distributed shared list.  3 simple functions are provided to interact with this list, `push`, `pop`, and `listLength`.  These lists are stored in Redis, and cannot be locked.  That said, a `push` and `pop` operation will guarantee that one-and-only-one copy of your data is returned to whichever application acted first (when popping) or an error will be returned (when pushing).

### api.cache.push
* Invoke: `api.cache.push(key, data, next)`
  * data must be serializable via JSON.stringify
* Callback: `next(error)`

### api.cache.pop
* Invoke: `api.cache.pop(key, next)`
* Callback: `next(error, data)`
  * data will be returned in the object form it was saved (array, object, string)

### api.cache.listLength
* Invoke: `api.cache.listLength(key, next)`
* Callback: `next(error, length)`
  * length will be an integer.
	* if the list does not exist, `0` will be returned

## Lock Methods

You may optionally implement locking methods along with your cache objects.  This will allow one ActionHero server to obtain a lock on an object and prevent modification of it by another member of the cluster.  For example you may want to first `api.cache.lock` a key, and then save it to prevent other nodes from modifying the object.

### api.cache.lock

* Invoke: `api.cache.lock(key, expireTimeMS, next)`
  * `expireTimeMS` is optional, and will be `expireTimeMS = api.cache.lockDuration = api.config.general.lockDuration`
* Callback: `next(error, lockOk)`
  * `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  * `lockOk` will be `true` or `false` depending on if the lock was obtained.

### api.cache.unlock

* Invoke: `api.cache.unlock(key, next)`
* Callback: `next(error, lockOk)`
  * `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  * `lockOk` will be `true` or `false` depending on if the lock was removed.

### api.cache.checkLock

* Invoke: `api.cache.checkLock(key,retry,  next)`
  * `retry` is either `null` or an integer (ms) that we should keep retrying until the lock is free to be re-obtained
* Callback: `next(error, lockOk)`
  * `error` will be null unless there was something wrong with the connection (perhaps a redis error)
  * `lockOk` will be `true` or `false` depending on if the lock is currently obtainable.

### api.cache.locks
* Invoke: `api.cache.locks(next)`
* Callback: `next(error, locks)`
	* `locks` is an array of all currently active locks


You can see an example of using the cache within an action in [actions/cacheTest.js](https://github.com/evantahler/actionhero/blob/master/actions/cacheTest.js)

## Redis

The timestamps regarding `api.cache.load` are to help clients understand if they are working with data which has been modified by another peer (when running in a cluster).

Keep in mind that many clients/servers can access a cached value simultaneously, so build your actions carefully not to have conflicting state.  You can [learn more about the cache methods here](/docs#general-cache-notes).  You can also [review recommendations about Production Redis configurations](/docs#redis-configurations).
