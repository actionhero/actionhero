![](file-server.svg)

## Overview

```bash
> curl localhost:8080/simple.html -v

*   Trying ::1..
* connect to ::1 port 8080 failed: Connection refused
*   Trying 127.0.0.1...
* Connected to localhost (127.0.0.1) port 8080
> GET /simple.html HTTP/1.1
> Host: localhost:8080
> User-Agent: curl/7.43.0
> Accept: */*
>
< HTTP/1.1 200 OK
< Last-Modified: Fri Jun 12 2015 02:51:29 GMT-0700 (PDT)
< Cache-Control: max-age=60, must-revalidate, public
< Expires: Sun, 15 Nov 2015 02:07:46 GMT
< Content-Type: text/html
< Access-Control-Allow-Headers: Content-Type
< Access-Control-Allow-Methods: HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE
< Access-Control-Allow-Origin: *
< X-Powered-By: actionhero API
< Set-Cookie: sessionID=d4453f54ff066a2ef078e5c80f18dc78a81f44ff;path=/;expires=Sun, 15 Nov 2015 03:06:46 GMT;
< Content-Length: 101
< Date: Sun, 15 Nov 2015 02:06:46 GMT
< Connection: keep-alive
<
* Connection #0 to host localhost left intact

<h1>ActionHero</h1>\nI am a flat file being served to you via the API from ./public/simple.html<br />
```

ActionHero comes with a file server which clients can make use of to request files from the ActionHero server. ActionHero is not meant to be a 'rendering' server, but can serve static files.

If a directory is requested rather than a file, ActionHero will look for the file in that directory defined by `api.config.commonWeb.directoryFileType` (which defaults to `index.html`). Failing to find this file, an error will be returned defined in `api.config.general.flatFileIndexPageNotFoundMessage`

You can use the `await api.staticFile.get(connection)` in your actions (where the response object contains `error`, `fileStream`, `mime`, and `length`). Note that fileStream is a stream which can be pipe'd to a client. You can use this in actions if you wish.

On unix/OSX operating systems, symlinks for both files and folders will be followed.

## Web Clients

*   `Cache-Control` and `Expires` or respectively `ETag` headers (depending on configuration) will be sent with it's caching or revalidation time defined by `api.config.servers.web.flatFileCacheDuration`
*   Content-Types for files will attempt to be determined using the [mime package](https://npmjs.org/package/mime)
*   Web clients may request `connection.params.file` directly within an action which makes use of `api.sendFile`, or if they are under the `api.config.servers.web.urlPathForFiles` route, the file will be looked up as if the route matches the directory structure under `flatFileDirectory`.

## Non-web Clients

*   the param `file` should be used to request a path
*   `file.content`'s data is sent `raw`, and is likely to contain binary content and line breaks. Parse your responses accordingly!

## Files From Actions

```js
// send a file
async run () {
  data.connection.sendFile('/path/to/file.mp3')
  data.toRender = false
}

// send 404 (web connection)
async run () {
  data.connection.rawConnection.responseHttpCode = 404;
  data.connection.sendFile('404.html')
  data.toRender = false
}
```

You can send files from within actions using `connection.sendFile()`.

Note that you can optionally modify responseCodes (for HTTP clients only). Be sure to set `toRender = false` in the callback, as you have already sent data to the client, and probably don't want to do so again on a file request. If you try to `sendFile` on a path that doesn't exist (within your public directory), the 404 header will be handled automatically for you.

## File Locations

ActionHero will check all paths defined by `api.config.general.paths.public` for files, in the order they are specified via that option, then check any public paths of your [plugins](tutorial-tplugins.html).
