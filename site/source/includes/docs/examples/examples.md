# Examples

There are full actionhero project examples:

- [https://github.com/evantahler/actionhero-tutorial](https://github.com/evantahler/actionhero-tutorial)
- [https://github.com/evantahler/actionhero-angular-bootstrap-cors-csrf](https://github.com/evantahler/actionhero-angular-bootstrap-cors-csrf)

## Example Actions

**[cachetest](https://github.com/evantahler/actionhero/blob/master/actions/cacheTest.js)**: This action demonstrates how to handle parameter checking for an actin, and how to use the internal cache methods of actionhero to save and recall data provided from a client.

**[randomNumber](https://github.com/evantahler/actionhero/blob/master/actions/randomNumber.js)**: This example shows how to craft a simple action with no input, but to respond differently to clients based on their HTTP method (if it exists)

**[status](https://github.com/evantahler/actionhero/blob/master/actions/status.js)**: This action will render some statistics about this actionhero node, and all nodes in the cluster.  Useful for health checks.

**[SimpleFileResponder](https://gist.github.com/evantahler/9541992)**: This action demonstrates how you can can manually send files from within actions.

**[JadefileResponder](https://gist.github.com/connanp/6169574)**: This snippet is for rendering Jade templates on the server for pushState single page apps in actionhero. Useful when you need to bootstrap model data on initial page load. It also pre-compiles the templates on server start and will recompile if they change.

**[oauth](https://gist.github.com/4326070)**: This file is actually 2 actions which are needed to authenticate a user against twitter's API.  Note the use of `api.cache` to save and load the temporary secret tokens, and how to send custom (redirect) headers with actionhero

**[Authentication Example](http://blog.evantahler.com/blog/authentication-with-actionHero-again.html)**: This example contains a working user system (auth, login, user creation, sessions, etc) using redis.

***[Tic-Tac-Toe API](https://gist.github.com/evantahler/5898472)*** This advanced example demonstrates how to create actions (and initializers) which will enable you to play tic-tac-toe against an AI Player.

## Example Clients

**[node via TCP](https://github.com/evantahler/actionhero-client)**: You can talk to an actionhero server from another node project over TCP directly using this package. 

**[node via HTTP/connect](https://github.com/evantahler/actionhero/blob/master/test/servers/web.js)**: actionhero has a robust test suite for the web server which users connect.

**[Angular](https://github.com/evantahler/actionhero-angular-bootstrap-cors-csrf/blob/master/public/js/app/app.js#L43-L89)**: You can connect to actionhero via angular and connect via HTTP or WebSocket (actionheroWebSocket).

## Example Initializers

**[mysql](https://gist.github.com/evantahler/801a07085f230fa7f55d)**: Use [sequilize.js](http://sequelizejs.com/) within an initializer

**[session](https://gist.github.com/evantahler/59ba68a5ef5990574b7d)**: use the cache methods and `connection.id` to easily make some session management helpers.

**[passport](https://gist.github.com/juancgarcia/e4caf5dc7474769f5137)**: Use the [passport](http://passportjs.org/) package for authentication in actionhero.

**[mongo](https://gist.github.com/evantahler/0c59aa8680259aee3e01)**: a MongoDB initializer

## Example Tasks

**[runAction](https://github.com/evantahler/actionhero/blob/master/tasks/runAction.js)**: This (non periodic) task is used to call an action in the background.  For example, you might have an action to `sendEmail` which can be called synchronously by a client, but you also might want to call it in a delayed manner.  This is the task for you!

**[sayHi](https://gist.github.com/evantahler/5aea80c04f14e8a88c91)** A very simple example which will just log 'HELLO' to the command line every 5 seconds.

**[cleanLogFiles](https://gist.github.com/evantahler/5f427cde60f2f88ad61b)**: This periodic task will run on all servers and inspect actionhero's `log` directly for large log files, and delete them

**[pingSocketClients](https://gist.github.com/evantahler/b2f6e90e800916d3d26d)**: This periodic task will run on all servers and send a 'ping' to any connected TCP clients to help them keep their
