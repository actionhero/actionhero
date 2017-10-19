![](documentation.svg)

## Overview

The web server exposes actions and files over http or https. You can visit the API in a browser, Curl, etc. `{url}?action=actionName` or `{url}/api/{actionName}` is how you would access an action. For example, using the default ports in `/config/servers/web.js` you could reach the status action with both `http://127.0.0.1:8080/status` or `http://127.0.0.1:8080/?action=status`

HTTP responses are always JSON and follow the following format:

```js
{
  hello: "world",
  serverInformation: {
    serverName: "actionhero API",
    apiVersion: 1,
    requestDuration: 14
  },
  requestorInformation: {
    remoteAddress: "127.0.0.1",
    RequestsRemaining: 989,
    recievedParams: {
      action: ""
    }
  }
}
```

## Full HTTP Example

```
> curl 'localhost:8080/api/status' -v | python -mjson.tool
* About to connect() to localhost port 8080 (#0)
*   Trying 127.0.0.1...
* connected
* Connected to localhost (127.0.0.1) port 8080 (#0)
> GET /api/status HTTP/1.1
> User-Agent: curl/7.24.0 (x86_64-apple-darwin12.0) libcurl/7.24.0 OpenSSL/0.9.8r zlib/1.2.5
> Host: localhost:8080
> Accept: */*
>
< HTTP/1.1 200 OK
< Content-Type: application/json
< X-Powered-By: actionhero API
< Date: Sun, 29 Jul 2012 23:25:53 GMT
< Connection: keep-alive
< Transfer-Encoding: chunked
<
{ [data not shown]
100   741    0   741    0     0   177k      0 --:--:-- --:--:-- --:--:--  361k
* Connection #0 to host localhost left intact
* Closing connection #0
{
    "requestorInformation": {
        "recievedParams": {
            "action": "status",
        },
        "remoteAddress": "127.0.0.1"
    },
    "serverInformation": {
        "apiVersion": "3.0.0",
        "currentTime": 1343604353551,
        "requestDuration": 1,
        "serverName": "actionhero API"
    },
    "stats":
        "id": "10.0.1.12:8080:4443:5000",
        "uptimeSeconds": 34.163
    }
}
```

* You can provide the `?callback=myFunc` param to initiate a JSONp response which will wrap the returned JSON in your callback `function`. The mime type of the response will change from JSON to Javascript.
* If everything went OK with your request, no error attribute will be set on the response, otherwise, you should see either a string or hash error response within your action
* To build the response for "hello" above, the action would have set `data.response.hello = 'world'` in an action.

## Config Options

`/config/servers/web.js` contains the settings for the web server. The relevant options are:

```js
exports['default'] = {
  servers: {
    web: function (api) {
      return {
        enabled: true,
        // HTTP or HTTPS?
        secure: false,
        // Passed to https.createServer if secure=true. Should contain SSL certificates
        serverOptions: {},
        // Should we redirect all traffic to the first host in this array if hte request header doesn't match?
        // i.e.: [ 'https://www.site.com' ]
        allowedRequestHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : [],
        // Port or Socket Path
        port: process.env.PORT || 8080,
        // Which IP to listen on (use '0.0.0.0' for all; '::' for all on ipv4 and ipv6)
        // Set to \`null\` when listening to socket
        bindIP: '0.0.0.0',
        // Any additional headers you want actionhero to respond with
        httpHeaders: {
          'X-Powered-By': api.config.general.serverName,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        // Route that actions will be served from; secondary route against this route will be treated as actions,
        //  IE: /api/?action=test == /api/test/
        urlPathForActions: 'api',
        // Route that static files will be served from;
        //  path (relative to your project root) to serve static content from
        //  set to \`null\` to disable the file server entirely
        urlPathForFiles: 'public',
        // When visiting the root URL, should visitors see 'api' or 'file'?
        //  Visitors can always visit /api and /public as normal
        rootEndpointType: 'file',
        // simple routing also adds an 'all' route which matches /api/:action for all actions
        simpleRouting: true,
        // queryRouting allows an action to be defined via a URL param, ie: /api?action=:action
        queryRouting: true,
        // The cache or (if etags are enabled) next-revalidation time to be returned for all flat files served from /public; defined in seconds
        flatFileCacheDuration: 60,
        // Add an etag header to requested flat files which acts as fingerprint that changes when the file is updated;
        // Client will revalidate the fingerprint at latest after flatFileCacheDuration and reload it if the etag (and therfore the file) changed
        // or continue to use the cached file if it's still valid
        enableEtag: true,
        // How many times should we try to boot the server?
        // This might happen if the port is in use by another process or the socketfile is claimed
        bootAttempts: 1,
        // Settings for determining the id of an http(s) request (browser-fingerprint)
        fingerprintOptions: {
          cookieKey: 'sessionID',
          toSetCookie: true,
          onlyStaticElements: false,
          settings: {
            path: '/',
            expires: 3600000
          }
        },
        // Options to be applied to incoming file uploads.
        //  More options and details at https://github.com/felixge/node-formidable
        formOptions: {
          uploadDir: os.tmpdir(),
          keepExtensions: false,
          maxFieldsSize: 1024 * 1024 * 100
        },
        // Should we pad JSON responses with whitespace to make them more human-readable?
        // set to null to disable
        padding: 2,
        // Options to configure metadata in responses
        metadataOptions: {
          serverInformation: true,
          requesterInformation: true
        },
        // When true, returnErrorCodes will modify the response header for http(s) clients if connection.error is not null.
        // You can also set connection.rawConnection.responseHttpCode to specify a code per request.
        returnErrorCodes: true,
        // should this node server attempt to gzip responses if the client can accept them?
        // this will slow down the performance of actionhero, and if you need this funcionality, it is recommended that you do this upstream with nginx or your load balancer
        compress: false,
        // options to pass to the query parser
        // learn more about the options @ https://github.com/hapijs/qs
        queryParseOptions: {}
      }
    }
  }
}
```

Note that if you wish to create a secure (https) server, you will be required to complete the serverOptions hash with at least a cert and a keyfile:

```js
config.server.web.serverOptions: {
  key: fs.readFileSync('certs/server-key.pem'),
  cert: fs.readFileSync('certs/server-cert.pem')
}
```

## The Connection Object

```js
{ id: '3e55b464fd34708eba26f609f44481a120e094a8-a6dfb60b-9562-4cc0-9d92-bc6cc1b622ba',
  connectedAt: 1447554153233,
  type: 'web',
  rawConnection:
   {
     req: {},
     res: {},
     params: { query: {} },
     method: 'GET',
     cookies: {},
     responseHeaders: [ [Object], [Object], [Object], [Object], [Object], [Object] ],
     responseHttpCode: 200,
     parsedURL:
      Url {},
  remotePort: 57259,
  remoteIP: '127.0.0.1',
  error: null,
  fingerprint: '3e55b464fd34708eba26f609f44481a120e094a8',
  rooms: [],
  params: { action: 'randomNumber', apiVersion: 1 },
  pendingActions: 1,
  totalActions: 1,
  messageCount: 0,
  canChat: false,
  sendMessage: [Function],
  sendFile: [Function]
}
```

when inspecting `data.connection` in actions or action middleware from web client, a few additional elements are added for convenience:

*   `connection.rawConnection.responseHeaders`: array of headers which can be built up in the action. Headers will be made unique, and latest header will be used (except setting cookies)
*   `connection.rawConnection.method`: A string, GET, POST, etc
*   `connection.rawConnection.cookies`: Hash representation of the connection's cookies
*   `connection.rawConnection.responseHttpCode`: the status code to be rendered to the user. Defaults to 200
*   `connection.type` for a HTTP client is "web"
*   `connection.rawConnection.params.body` will contain un-filtered form data
*   `connection.rawConnection.params.files` will contain un-filtered form data
*   `connection.extension`. If are using a route to access an action, and the request path ends in a file extension (IE: `server.com/action/option.jpg`), the extension will be available. Depending on the server's options, this extension may also be used to modify the response mime-type by configuring `matchExtensionMimeType` within each action.


## Sending Files

```js
data.connection.sendFile('/path/to/file.mp3');
data.toRender = false;
next();
```

ActionHero can also serve up flat files. ActionHero will not cache these files and each request to `file` will re-read the file from disk (like the nginx web server).

There are helpers you can use in your actions to send files:

*   `/public` and `/api` are routes which expose the directories of those types. These top level path can be configured in `/config/servers/web.js` with `api.config.servers.web.urlPathForActions` and `api.config.servers.web.urlPathForFiles`.
*   the root of the web server "/" can be toggled to serve the content between /file or /api actions per your needs `api.config.servers.web.rootEndpointType`. The default is `api`.
*   ActionHero will serve up flat files (html, images, etc) as well from your ./public folder. This is accomplished via the `file` route as described above. `http://{baseUrl}/public/{pathToFile}` is equivalent to `http://{baseUrl}?action=file&fileName={pathToFile}` and `http://{baseUrl}/file/{pathToFile}`.
*   Errors will result in a 404 (file not found) with a message you can customize.
*   Proper mime-type headers will be set when possible via the `mime` package.

See the [file server](tutorial-file-server.html) page for more documentation

## Routes

For web clients, you can define an optional RESTful mapping to help route requests to actions. If the client doesn't specify an action via a param, and the base route isn't a named action, the action will attempt to be discerned from this `config/routes.js` file.

This variables in play here are:

*   `api.config.servers.web.urlPathForActions`
*   `api.config.servers.web.rootEndpointType`
*   and of course the content of `config/routes.js`

Say you have an action called ‘status' (like in a freshly generated ActionHero project). Lets start with ActionHero's default config:

```js
api.config.servers.web.urlPathForActions = ‘api';
api.config.servers.web.urlPathForFiles = ‘public';
api.config.servers.web.rootEndpointType = ‘file';
```

There are 3 ways a client can access actions via the web server.

*   no routing at all and use GET params: `server.com/api?action=status`
*   with ‘basic' routing, where the action's name will respond after the /api path: `server.com/api/status`
*   or you can modify this with routes. Say you want `server.com/api/stuff/statusPage`

```js
exports.default = function(api) {
  return {
    get: [
      { path: ‘/stuff/statusPage', action: ‘status' }
    ]
  };
}
```

If the `api.config.servers.web.rootEndpointType` is `"file"` which means that the routes you are making are active only under the `/api` path. If you wanted the route example to become `server.com/stuff/statusPage`, you would need to change `api.config.servers.web.rootEndpointType` to be ‘api'. Note that making this change doesn't stop `server.com/api/stuff/statusPage` from working as well, as you still have `api.config.servers.web.urlPathForActions` set to be ‘api', so both will continue to work.

For a route to match, all params must be satisfied. So, if you expect a route to provide `api/:a/:b/:c` and the request is only for `api/:a/:c`, the route won't match. This holds for any variable, including `:apiVersion`. If you want to match both with and without apiVersion, just define the rote 2x, IE:

```js
exports.default = function(api) {
  return {
    all: [
      { path: "/cache/:key/:value",             action:  "cacheTest" },
      { path: "/:apiVersion/cache/:key/:value", action:  "cacheTest" },
    ]
  };
}
```

If you want to shut off access to your action at `server.com/api/stuff/statusPage` and only allow access via `server.com/stuff/statusPage`, you can disable `api.config.servers.web.urlPathForActions` by setting it equal to `null` (but keeping the `api.config.servers.web.rootEndpointType` equal to `api`).

Routes will match the newest version of `apiVersion`. If you want to have a specific route match a specific version of an action, you can provide the `apiVersion` param in your route definitions:

```js
exports.default = function(api) {
  return {
    get: [
      { path: "/myAction/old", action:  "myAction", apiVersion: 1 },
      { path: "/myAction/new", action:  "myAction", apiVersion: 2 },
    ]
  };
}
```

This would create both `/api/myAction/old` and `/api/myAction/new`, mapping to apiVersion 1 and 2 respectively.

In your actions and middleware, if a route was matched, you can see the details of the match by inspecting `data.connection.matchedRoute` which will include `path` and `action`.

Finally, you can toggle an option, `matchTrailingPathParts`, which allows the final segment of your route to absorb all trailing path parts in a matched variable.

```js
post: [
  // yes match: site.com/api/123
  // no match: site.com/api/123/admin
  { path: '/login/:userId(.*)', action: 'login' }
],

post: [
  // yes match: site.com/api/123
  // yes match: site.com/api/123/admin
  { path: '/login/:userId(.*)', action: 'login', matchTrailingPathParts: true }
],
```

This also enables "catch all" routes, like:

```js
get: [
  { path: ‘:path(.*)', action: ‘catchAll', matchTrailingPathParts: true }
],
```

If you have a route with multiple variables defined and `matchTrailingPathParts` is true, only the final segment will match the trailing sections:

```js
get: [
  // the route site.com/users/123/should/do/a/thing would become {userId: 123, path: ‘/should/do/a/thing'}
  { path: ‘/users/:userId/:path(.*)', action: ‘catchAll', matchTrailingPathParts: true }
],
```

**Note**: In regular expressions used for routing, you cannot use the "/" character.

#### Handling Static Folders with Routes

If you want map a special public folder to a given route you can use the "dir" parameter in your "get" routes in the routes.js file:

```js
get: [
  { path: ‘/my/special/folder', dir: __dirname + ‘/…/public/my/special/folder', matchTrailingPathParts: true }
],
```

After mapping this route all files/folders within the mapped folder will be accessible on the route.

You have to map the specified public folder within the "dir" parameter, relative to the routes.js file or absolute. Make sure to set "matchTrailingPathParts" to "true", because when it is set to false, the route will never match when you request a file. (e.g.: site.com/my/special/folder/testfile.txt).

#### Route Notes

*   actions defined in params directly `action=theAction` or hitting the named URL for an action `/api/theAction` will never override RESTful routing
*   you can mix explicitly defined params with route-defined params. If there is an overlap, the route-defined params win
    *   IE: /api/user/123?userId=456 => `connection.userId = 123`
*   routes defined with the "all" method will be duplicated to "get", "put", "post", and "delete"
*   use ":variable" to define "variable"
*   an undefined ":variable" will not match
    *   IE: "/api/user/" will not match "/api/user/:userId"
    *   You would need a second route in this case to match "/api/user"
*   routes are matched as defined top-down in `routes.js`
*   you can optionally define a regex match along with your route variable
    *   IE: `{`path:"/game/:id(^[a-z]{0,10}$)", action: "gamehandler" }`}`
    *   be sure to double-escape when needed: `{` path: "/login/:userID(^\\d{3}$)", action: "login" }`}`
*   The HTTP verbs which you can route against are: `api.routes.verbs = ['head', 'get', 'post', 'put', 'patch', 'delete']`

```js
exports.default = function(api) {
  return {
    get: [
      { path: "/users", action: "usersList" }, // (GET) /api/users
      { path: "/search/:term/limit/:limit/offset/:offset", action: "search" }, // (GET) /api/search/car/limit/10/offset/100
    ],

    post: [
      { path: "/login/:userID(^\\d{3}$)", action: "login" } // (POST) /api/login/123
    ],

    all: [
      { path: "/user/:userID", action: "user" } // (*) / /api/user/123
    ]
  };
}
```

## Hosts

ActionHero allows you to define a collection of host headers which this API server will allow access from. You can set these via `api.config.servers.web.allowedRequestHosts`. If the `Host` header of a client does not match one of those listed (protocol counts!), they will be redirected to the first one present.

You can also set `process.env.ALLOWED_HOSTS` which will be parsed as a comma-separated list of Hosts which will set `api.config.servers.web.allowedRequestHosts`

## Parameters

Params provided by the user (GET, POST, etc for http and https servers, setParam for TCP clients, and passed to action calls from a web socket client) will be checked against a whitelist defined by your action (can be disabled in `/config/servers/web.js`). Variables defined in your actions by `action.inputs` will be added to your whitelist. Special params which the api will always accept are:

```js
[
  ‘file',
  ‘apiVersion',
  ‘callback',
  ‘action',
]
```

Params are loaded in this order GET -> POST (normal) -> POST (multipart). This means that if you have `{url}?key=getValue` and you post a variable `key=postValue` as well, the `postValue` will be the one used. The only exception to this is if you use the URL method of defining your action. You can add arbitrary params to the whitelist by adding them to the `api.postVariables` array in your initializers.

File uploads from forms will also appear in `connection.params`, but will be an object with more information. That is, if you uploaded a file called "image", you would have `connection.params.image.path`, `connection.params.image.name` (original file name), and `connection.params.image.type` available to you.

A note on JSON payloads:

You can post BODY json paylaods to actionHero in the form of a hash or array.

**Hash**: `curl -X POST -d '{"key":"something", "value":{"a":1, "b":2}}' http://localhost:8080/api/cacheTest`. This will result in:

```js
connection.params = {
  key: ‘something',
  value: {
    a: 1,
    b: 2
  }
}
```

**Array**: `curl -X POST -d '[{"key":"something", "value":{"a":1, "b":2}}]' http://localhost:8080/api/cacheTest`. In this case, we set the array to the param key `payload`:

```js
connection.params = {
  payload: [
    {
      key: ‘something'
      value: {
        a: 1,
        b: 2
      }
    }
  ]
}
```

### Uploading Files

ActionHero uses the [formidable](https://github.com/felixge/node-formidable) form parsing library. You can set options for it via `api.config.servers.web.formOptions`. You can upload multiple files to an action and they will be available within `connection.params` as formidable response objects containing references to the original file name, where the uploaded file was stored temporarily, etc. Here is an example:

```js
// actions/uploader.js

exports.action = {
  name: 'uploader',
  description: 'uploader',
  inputs: {
    file1: {required: true},
    file2: {required: false},
    key1: {required: false},
    key2: {required: false},
  },
  outputExample: null,
  run: function(api, data, next){
    console.log(data.params);
    next();
  }
};
```

```html
<!-- public/uploader.html -->

<html>
    <head></head>
    <body>
        <form method="post" enctype="multipart/form-data" action="http://localhost:8080/api/uploader">
            <input type="file" name="file1" />
            <input type="file" name="file2" />
            <br><br>
            <input type='text' name="key1" />
            <input type='text' name="key2" />
            <br><br>
            <input type="submit" value="send" />
        </form>
    </body>
</html>
```

```js
// what the params look like to an action

{ action: 'uploader',
  file1:
   { domain: null,
     _events: null,
     _maxListeners: 10,
     size: 5477608,
     path: '/app/actionhero/tmp/86b2aa018a9785e20b3f6cea95babcca',
     name: '1-02 Concentration Enhancing Menu Initialiser.mp3',
     type: 'audio/mp3',
     hash: false,
     lastModifiedDate: Wed Feb 13 2013 20:32:49 GMT-0800 (PST),
     _writeStream:
      { ... },
     length: [Getter],
     filename: [Getter],
     mime: [Getter] },
  file2:
   { domain: null,
     _events: null,
     _maxListeners: 10,
     size: 10439802,
     path: '/app/actionhero/tmp/6052010f1d75ceaeb9197a9a759124dc',
     name: '1-10 There She Is.mp3',
     type: 'audio/mp3',
     hash: false,
     lastModifiedDate: Wed Feb 13 2013 20:32:49 GMT-0800 (PST),
     _writeStream:
      { ... },
  key1: '123',
  key2: '456',
 }
 ```

 ## Client Library

 Although the `ActionheroWebsocketClient` client-side library is mostly for websockets, it can now be used to make http actions when not connected (and websocket clients will fall back to http actions when disconnected)

```html
<script src="/public/javascript/ActionheroWebsocketClient.js"></script>

<script>
  var client = new ActionheroWebsocketClient();
  client.action('cacheTest', {key: 'k', value: 'v'}, function(error, data){
     // do stuff
  });
</script>
```

Note that we never called `client.connect`. More information can be found on the [websocket server docs page](/docs/servers/websocket).
