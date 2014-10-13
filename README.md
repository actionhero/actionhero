# actionhero.js 
## The Reusable, Scalable, and Quick node.js API Server

**Links: [NPM](https://npmjs.org/package/actionhero) | [Docs](http://actionherojs.com/docs) | [Public Site](http://www.actionherojs.com) | [GitHub](https://github.com/evantahler/actionhero) | [Mailing List](https://groups.google.com/forum/?fromgroups=#!forum/actionhero-js) | [Chat](https://gitter.im/evantahler/actionhero) | [Client](https://github.com/evantahler/actionhero_client)**

<img src="https://raw.github.com/evantahler/actionhero/master/public/logo/actionhero.png" height="300"/>

[![Nodei stats](https://nodei.co/npm/actionhero.png?downloads=true)](https://npmjs.org/package/actionhero)

[![NPM](https://nodei.co/npm-dl/actionhero.png)](https://npmjs.org/package/actionhero)

[![Nodejitsu Deploy Status Badges](https://webhooks.nodejitsu.com/evantahler/actionhero.png)](http://demo.actionherojs.com)

[![Build Status](https://secure.travis-ci.org/evantahler/actionhero.png?branch=master)](http://travis-ci.org/evantahler/actionhero) [![Dependency Status](https://gemnasium.com/evantahler/actionhero.svg)](https://gemnasium.com/evantahler/actionhero) [![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/evantahler/actionhero?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)


## Who is the actionhero?
actionhero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks. The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  Clients connected to an actionhero server can [**consume the api**](http://actionherojs.com/docs/core/actions.html), [**consume static content**](http://actionherojs.com/docs/core/file-server.html), and [**communicate with each other**](http://actionherojs.com/docs/core/chat.html).  actionhero is cluster-ready, with built in support for background tasks, 0-downtime deploys, and more.

Currently actionhero supports:

- [Web Clients](http://actionherojs.com/docs/servers/web.html): HTTP, HTTPS
- [Socket Clients](http://actionherojs.com/docs/servers/socket.html): TCP (telnet), TLS
- [Web Socket Clients](http://actionherojs.com/docs/servers/websocket.html): HTTP, HTTPS

[You can also make your own servers and transports.](http://actionherojs.com/docs/core/servers.html)

## Quick Start

- `npm install actionhero`
- `./node_modules/.bin/actionhero generate`
- `npm start`

Or spawn a web API server now:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/evantahler/actionhero)

## Want more?

- [Getting Started](http://actionherojs.com/docs/ops/getting-started.html)
- [Running actionhero](http://actionherojs.com/docs/ops/running-actionhero.html)
- [Read the documentation](http://actionherojs.com/docs)
- [View the release history](https://github.com/evantahler/actionhero/releases/)

## Who?
* The primary creator of the actionhero framework is [Evan Tahler](http://evantahler.com), but many others [have helped](https://github.com/evantahler/actionhero/graphs/contributors)
* Logo by [Ali Spagnola](http://alispagnola.com/)
* If you want to contribute to actionhero, contribute to the conversation on [github](https://github.com/evantahler/actionhero)

###
