---
layout: docs
title: Documentation - Example Actions
---

# Example Actions

**[cachetest](https://github.com/evantahler/actionhero/blob/master/actions/cacheTest.js)**: This action demonstrates how to handle parameter checking for an actin, and how to use the internal cache methods of actionhero to save and recall data provided from a client.

**[randomNumber](https://github.com/evantahler/actionhero/blob/master/actions/randomNumber.js)**: This example shows how to craft a simple action with no input, but to respond differently to clients based on their HTTP method (if it exists)

**[status](https://github.com/evantahler/actionhero/blob/master/actions/status.js)**: This action will render some statistics about this actionhero node, and all nodes in the cluster.  Useful for health checks.

**[SimpleFileResponder](https://gist.github.com/evantahler/9541992)**: This action demonstrates how you can can manually send files from within actions.

**[JadefileResponder](https://gist.github.com/connanp/6169574)**: This snippet is for rendering Jade templates on the server for pushState single page apps in actionhero. Useful when you need to bootstrap model data on initial page load. It also pre-compiles the templates on server start and will recompile if they change.

**[oauth](https://gist.github.com/4326070)**: This file is actually 2 actions which are needed to authenticate a user against twitter's API.  Note the use of `api.cache` to save and load the temporary secret tokens, and how to send custom (redirect) headers with actionhero

**[Authentication Example](http://blog.evantahler.com/blog/authentication-with-actionHero-again.html)**: This example contains a working user system (auth, login, user creation, sessions, etc) using redis.

***[Tic-Tac-Toe API](https://gist.github.com/evantahler/5898472)*** This advanced example demonstrates how to create actions (and initializers) which will enable you to play tic-tac-toe against an AI Player.
