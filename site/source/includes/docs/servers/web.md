# Web Server

## General

```javascript

{
  hello: "world"
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

The web server exposes actions and files over http or https.  You can visit the API in a browser, Curl, etc. `{url}?action=actioName` or `{url}/api/{actioName}` is how you would access an action.  For example, using the default ports in `/config/servers/web.js` you could reach the status action with both `http://127.0.0.1:8080/status` or `http://127.0.0.1:8080/?action=status`  

HTTP responses are always JSON and follow the format => 

## HTTP Example: 

```bash

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
    "stats": {
        "cache": {
            "numberOfObjects": 0
        }, 
        "id": "10.0.1.12:8080:4443:5000", 
        "memoryConsumption": 8421200, 
        "peers": [
            "10.0.1.12:8080:4443:5000"
        ], 
        "queue": {
            "queueLength": 0, 
            "sleepingTasks": []
        }, 
        "socketServer": {
            "numberOfGlobalSocketRequests": 0, 
            "numberOfLocalActiveSocketClients": 0, 
            "numberOfLocalSocketRequests": 0
        }, 
        "uptimeSeconds": 34.163, 
        "webServer": {
            "numberOfGlobalWebRequests": 5, 
            "numberOfLocalWebRequests": 3
        }, 
        "webSocketServer": {
            "numberOfGlobalWebSocketRequests": 0, 
            "numberOfLocalActiveWebSocketClients": 0
        }
    }
}
```

* you can provide the `?callback=myFunc` param to initiate a JSONp response which will wrap the returned JSON in your callback function.  The mime type of the response will change from JSON to Javascript. 
* If everything went OK with your request, no error attribute will be set on the response, otherwise, you should see either a string or hash error response within your action
* to build the response for "hello" above, the action would have set `connection.response.hello = "world";`

## Config Settings

`/config/servers/web.js` contains the settings for the web server.  The relevant options are:

```javascript
config.servers = {
  "web" : {
    secure: false,                       // HTTP or HTTPS?
    serverOptions: {},                   // Passed to https.createServer if secure=ture. Should contain SSL certificates
    port: 8080,                          // Port or Socket
    bindIP: "0.0.0.0",                   // Which IP to listen on (use 0.0.0.0 for all)
    httpHeaders : {                      // Any additional headers you want actionhero to respond with
      'Access-Control-Allow-Origin' : '*',
      'Access-Control-Allow-Methods': 'PUT, GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },    
    urlPathForActions : "api",           // Route that actions will be served from; secondary route against this route will be treated as actions, IE: /api/?action=test == /api/test/
    urlPathForFiles : "public",          // Route that static files will be served from; path (relitive to your project root) to server static content from
    rootEndpointType : "api",            // When visiting the root URL, should visitors see "api" or "file"? Visitors can always visit /api and /public as normal
    directoryFileType : "index.html",    // The default filetype to server when a user requests a directory
    flatFileCacheDuration : 60,          // The header which will be returned for all flat file served from /public; defined in seconds
    fingerprintOptions : {               // Settings for determining the id of an http(s) requset (browser-fingerprint)
      cookieKey: "sessionID",
      toSetCookie: true,
      onlyStaticElements: false
    },
    formOptions: {                       // Options to be applied to incomming file uplaods. More options and details at https://github.com/felixge/node-formidable
      uploadDir: "/tmp",
      keepExtensions: false,
      maxFieldsSize: 1024 * 1024 * 100
    },
    metadataOptions: {                   // Options to configure metadata in responses
      serverInformation: true,
      requestorInformation: true
    },
    returnErrorCodes: false              // When true, returnErrorCodes will modify the response header for http(s) clients if connection.error is not null. You can also set connection.rawConnection.responseHttpCode to specify a code per request.
  }
}  
```

Note that if you wish to create a secure (https) server, you will be required to complete the serverOptions hash with at least a cert and a keyfile:

```javascript
config.server.web.serverOptions: {
  key: fs.readFileSync('certs/server-key.pem'),
  cert: fs.readFileSync('certs/server-cert.pem')
}
```
	
## The `connection` object

```javascript
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
  sendFile: [Function] }
```

when inspecting `connection` in actions from web client, a few additional elements are added for convenience:

- `connection.rawConnection.responseHeaders`: array of headers which can be built up in the action.  Headers will be made unique, and latest header will be used (except setting cookies)
- `connection.rawConnection.method`: A string, GET, POST, etc
- `connection.rawConnection.cookies`: Hash representation of the connection's cookies
- `connection.rawConnection.responseHttpCode`: the status code to be rendered to the user.  Defaults to 200
- `connection.type` for a HTTP client is "web"
- `connection.rawConnection.params.body` will contain un-filtered form data
- `connection.rawConnection.params.files` will contain un-filtered form data
- `connection.extension`.  If are using a route to access an action, and the request path ends in a file extension (IE: `server.com/action/option.jpg`), the extension will be available.  Depending on the server's options, this extension may also be used to modify the response mime-type by configuring `matchExtensionMimeType` within each action.

Of course, the generic connection attributes (`connection.error`, `connection.params`, etc) will be present.


## Sending Files

```javascript
data.connection.sendFile('/path/to/file.mp3');
data.toRender = false;
next();
```

actionhero can also serve up flat files.  actionhero will not cache these files and each request to `file` will re-read the file from disk (like the nginx web server).

* /public and /api are  routes which expose the 'directories' of those types.  These top level path can be configured in `/config/servers/web.js` with `api.config.servers.web.urlPathForActions` and `api.config.servers.web.urlPathForFiles`.
* the root of the web server "/" can be toggled to serve the content between /file or /api actions per your needs `api.config.servers.web.rootEndpointType`. The default is `api`.
* actionhero will serve up flat files (html, images, etc) as well from your ./public folder.  This is accomplished via the 'file' route as described above. `http://{baseUrl}/public/{pathToFile}` is equivalent to `http://{baseUrl}?action=file&fileName={pathToFile}` and `http://{baseUrl}/file/{pathToFile}`. 
* Errors will result in a 404 (file not found) with a message you can customize.
* Proper mime-type headers will be set when possible via the `mime` package.

There are helpers you can use in your actions to send files:

See the [file server](/docs#file-server) page for more documentation

## Routes

For web clients (http and https), you can define an optional RESTful mapping to help route requests to actions.  If the client doesn't specify an action via a param, and the base route isn't a named action, the action will attempt to be discerned from this `config/routes.js` file.

#### Example

This variables in play here are:

- `api.config.servers.web.urlPathForActions`
- `api.config.servers.web.rootEndpointType`
- and of course the content of `config/routes.js`

Say you have an action called 'status' (like in a freshly generated actionhero project). 
Lets start with actionhero's default config:

```javascript
api.config.servers.web.urlPathForActions = 'api';
api.config.servers.web.urlPathForFiles = 'public';
api.config.servers.web.rootEndpointType = 'file';
```

There are 3 ways a client can access actions via the web server.

- no routing at all and use GET params: `server.com/api?action=status`
- with 'basic' routing, where the action's name will respond after the /api path: `server.com/api/status`
- or you can modify this with routes. Say you want `server.com/api/stuff/statusPage`

```javascript
exports.default = function(api) {
  return {
    get: [
      { path: '/stuff/statusPage', action: 'status' }
    ]
  };
}
```

If the `api.config.servers.web.rootEndpointType` is `"file"` which means that the routes you are making are active only under the `/api` path.  If you wanted the route example to become  `server.com/stuff/statusPage`, you would need to change `api.config.servers.web.rootEndpointType` to be 'api'.  Note that making this change doesn't stop `server.com/api/stuff/statusPage` from working as well, as you still have `api.config.servers.web.urlPathForActions` set to be 'api', so both will continue to work.

For a route to match, all params must be satisfied.  So, if you expect a route to provide `api/:a/:b/:c` and the request is only for `api/:a/:c`, the route won't match. This holds for any variable, including `:apiVersion`.  If you want to match both with and without apiVersion, just define the rote 2x, IE:

```javascript
exports.default = function(api) {
  return {
    all: [
      { path: "/cache/:key/:value",             action:  "cacheTest" },
      { path: "/:apiVersion/cache/:key/:value", action:  "cacheTest" },
    ]
  };
}
```

If you want to shut off access to your action at `server.com/api/stuff/statusPage` and only allow access via `server.com/stuff/statusPage`, you can disable `api.config.servers.web.urlPathForActions` by setting it equal to `null` (but keeping the `api.config.servers.web.rootEndpointType` equal to 'api'). 

Routes will match the newest version of `apiVersion`.  If you want to have a specific route match a specific version of an action, you can provide the `apiVersion` param in your route definitions:

```javascript
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

#### Notes

- actions defined in params directly `action=theAction` or hitting the named URL for an action `/api/theAction` will never override RESTful routing 
- you can mix explicitly defined params with route-defined params.  If there is an overlap, the route-defined params win
  - IE: /api/user/123?userId=456 => `connection.userId = 123`
- routes defined with the "all" method will be duplicated to "get", "put", "post", and "delete"
- use ":variable" to define "variable"
- an undefined ":variable" will not match
  - IE: "/api/user/" will not match "/api/user/:userId"
  - You would need a second route in this case to match "/api/user"
- routes are matched as defined top-down in `routes.js`
- you can optionally define a regex match along with your route variable
  - IE: `{ path:"/game/:id(^[a-z]{0,10}$)", action: "gamehandler" }`
  - be sure to double-escape when needed: `{ path: "/login/:userID(^\\d{3}$)", action: "login" }`

**example**:

```javascript
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

## Params

Params provided by the user (GET, POST, etc for http and https servers, setParam for TCP clients, and passed to action calls from a web socket client) will be checked against a whitelist defined by your action (can be disabled in `/config/servers/web.js`).  Variables defined in your actions by `action.inputs` will be added to your whitelist.  Special params which the api will always accept are: 

```javascript
  [ 'file',
    'apiVersion',
    'callback',
    'action', ]
```
	
Params are loaded in this order GET -> POST (normal) -> POST (multipart).  This means that if you have `{url}?key=getValue` and you post a variable `key=postValue` as well, the `postValue` will be the one used.  The only exception to this is if you use the URL method of defining your action.  You can add arbitrary params to the whitelist by adding them to the `api.postVariables` array in your initializers. 

File uploads from forms will also appear in `connection.params`, but will be an object with more information.  That is, if you uploaded a file called "image", you would have `connection.params.image.path`, `connection.params.image.name` (original file name), and `connection.params.image.type` available to you. 

A note on JSON payloads:

You can post BODY json paylaods to actionHero in the form of a hash or array. 

Hash: `curl -X POST -d '{"key":"something", "value":{"a":1, "b":2}}' http://localhost:8080/api/cacheTest`.  This will result in:

```javascript
connection.params = {
  key: 'something'
  value: {
    a: 1,
    b: 2
  }
}
```

Array: `curl -X POST -d '[{"key":"something", "value":{"a":1, "b":2}}]' http://localhost:8080/api/cacheTest`.
In this case, we set the array to the param key `payload`:

```javascript
connection.params = {
  payload: [
    { 
      key: 'something'
      value: {
        a: 1,
        b: 2
      }
    }
  ]
}
```

## Uploading Files

actionhero uses the [formidable](https://github.com/felixge/node-formidable) form parsing library.  You can set options for it via `api.config.commonWeb.formOptions`.  You can upload multiple files to an action and they will be available within `connection.params` as formidable response objects containing references to the original file name, where the uploaded file was stored temporarily, etc.   Here's an example:

```javascript
// actions/uploader.js 

exports.action = {
  name: 'uploader',
  description: 'uploader',
  inputs: {
    file1: {optional: true},
    file2: {optional: true},
    key1: {optional: true},
    key2: {optional: true},
  }, 
  outputExample: null,
  run: function(api, data, next){
    console.log("\r\n\r\n")
    console.log(data.params);
    console.log("\r\n\r\n")
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

```javascript
// what the params look like to an action
{ action: 'uploader',
  file1: 
   { domain: null,
     _events: null,
     _maxListeners: 10,
     size: 5477608,
     path: '/Users/evantahler/PROJECTS/actionhero/tmp/86b2aa018a9785e20b3f6cea95babcca',
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
     path: '/Users/evantahler/PROJECTS/actionhero/tmp/6052010f1d75ceaeb9197a9a759124dc',
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

Although the `actionheroClient` client-side library is mostly for websockets, it can now be used to make http actions when not connected (and websocket clients will fall back to http actions when disconnected)

```html
<script src="/public/javascript/actionheroClient.js"></script>

<script>
var client = new ActionheroClient();
client.action('cacheTest', {key: 'k', value: 'v'}, function(err, data){
   // do stuff
}); 
</script>
```

Note that we never called `client.connect`.  More information can be found on the [websocket server docs page](/docsdocs#websocket-server).
