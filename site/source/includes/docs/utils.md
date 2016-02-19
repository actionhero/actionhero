# Utils

ActionHero ships with a few utility methods exposed for your convince: 

### api.utils.hashLength(obj)
- calculates the 'size' of primary, top level keys in the hash
- `api.utils.hashLength({a: 1, b: 2})` would be 2

### api.utils.hashMerge(a, b)
- create a new hash which looks like b merged into a
- `{a:1, b:2}` merged with `{b:3, c:4}` looks like `{a: 1, b:3, c:4}`

### api.utils.isPlainObject(object)
- determines if `object` is a plain js 'Object' or somethign more complex, like a stream

### api.utils.arrayUniqueify(arr)
- removes duplicate entries from an array

### api.utils.objClone(obj)
- creates a new object with the same keys and values of the original object

### api.utils.getExternalIPAddress()
- attempts to determine this server's external IP address out of all plausible addressees this host is listening on

### api.utils.parseCookies(req)
- a helper to parse the request object's headers and returns a hash of the client's cookies

### api.utils.parseIPv6URI(address)
- will return `{host: host, port: port}` for an IPv6 address