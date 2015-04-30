---
layout: docs
title: Documentation - File Server
---

# File Server

## General

actionhero comes with a file server which clients can make use of to request files on the actionhero server.  actionhero is not meant to be a 'rendering' server (like express or rails), but can serve static files.

If a directory is requested rather than a file, actionhero will look for the file in that directory defined by `api.config.commonWeb.directoryFileType` (which defaults to `index.html`).  Failing to find this file, an error will be returned defined in `api.config.general.flatFileIndexPageNotFoundMessage`

You can use the `api.staticFile.get(connection, next)` in your actions (where `next(connection, error, fileStream, mime, length)`).  Note that fileStream is a stream which can be pipe'd to a client.  You can use this in actions if you wish, 

On .nix operating system's symlinks for both files and folders will be followed. 

## Web Clients

- `Cache-Control` and `Expires` headers will be sent, as defined by `api.config.commonWeb.flatFileCacheDuration`
- Content-Types for files will attempt to be determined using the [mime package](https://npmjs.org/package/mime)
- web clients may request `connection.params.file` directly within an action which makes use of  `api.sendFile`, or if they are  under the `api.config.servers.web.urlPathForFiles` route, the file will be looked up as if the route matches the directory structure under `flatFileDirectory`.
- if your action wants to send content down to a client directly, you will do so like this `server.sendFile(connection._originalConnection, null, stream, 'text/html', length);`

## Non-web Clients

- the param `file` should be used to request a path
- file data is sent `raw`, and is likely to contain binary content and line breaks.  Parse your responses accordingly! 

## Sending files from Actions

You can send files from within actions using `connection.sendFile()`.  Here's an example:

{% highlight javascript %}
connection.rawConnection.responseHttpCode = 404; 
connection.sendFile('404.html');
next(connection, false);
{% endhighlight %}

Note that you can optionally modify responseCodes (for HTTP clients only).  Be sure to set `toRender = false` in the callback, as you have already sent data to the client, and probably don't want to do so again on a file request.

## Customizing the File Server

By default, we want actionhero's file server to be very locked-down, and only serve files from directories defined in `api.config.general.paths.public`.  This is the safest default for beginners. However, you can customize things by changing the behavior of `api.staticFile.path()`.  For example:

{% highlight javascript %}
// in an initializer, override api.staticFile.path

api.staticFile.path = function(connection){
  if(connection.action == 'sendFile'){
    return '/tmp/uploads';
  }else{
    return api.config.general.paths.public[0];
  }
}
{% endhighlight %}

This would serve files from `/public` for all requests except the `sendFile` action, which will serve files from `/tmp`