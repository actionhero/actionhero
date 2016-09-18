# actionhero.js

## The Reusable, Scalable, and Quick node.js API Server

![https://raw.github.com/evantahler/actionhero/master/public/logo/actionhero-small.png](https://raw.github.com/evantahler/actionhero/master/public/logo/actionhero-small.png)

***
**[NPM](https://npmjs.org/package/actionhero) | [Docs](http://actionherojs.com/docs) | [Public Site](http://www.actionherojs.com) | [GitHub](https://github.com/evantahler/actionhero) | [Mailing List](https://groups.google.com/forum/?fromgroups=#!forum/actionhero-js) | [Chat](http://slack.actionherojs.com) | [Client](https://github.com/evantahler/actionhero-client)**
***

[![NPM Version](https://img.shields.io/npm/v/actionhero.svg?style=flat-square)](https://www.npmjs.com/package/actionhero)[![Node Version](https://img.shields.io/node/v/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)[![NPM](https://img.shields.io/npm/dm/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)[![Build Status](https://img.shields.io/travis/evantahler/actionhero/master.svg?style=flat-square)](http://travis-ci.org/evantahler/actionhero)[![Dependency Status](https://david-dm.org/evantahler/actionhero.svg?style=flat-square)](https://david-dm.org/evantahler/actionhero)[![Chat](http://slack.actionherojs.com/badge.svg)](http://slack.actionherojs.com)[![Coverage Status](https://coveralls.io/repos/evantahler/actionhero/badge.svg?branch=master)](https://coveralls.io/r/evantahler/actionhero?branch=master)[![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/l0oky/awesome-actionhero)

## Who is the actionhero?
actionhero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks. The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  Clients connected to an actionhero server can [**consume the api**](http://www.actionherojs.com/docs/#actions), [**consume static content**](http://www.actionherojs.com/docs/#file-server), and [**communicate with each other**](http://www.actionherojs.com/docs/#chat).  actionhero is cluster-ready, with built in support for background tasks, 0-downtime deploys, and more.

Currently actionhero supports:

- [Web Clients](http://www.actionherojs.com/docs/#web-server): HTTP, HTTPS
- [Socket Clients](http://www.actionherojs.com/docs/#socket-server): TCP (telnet), TLS
- [Web Socket Clients](http://www.actionherojs.com/docs/#websocket-server): HTTP, HTTPS

[You can also make your own servers and transports.](http://www.actionherojs.com/docs/#servers)

## Quick Start
```bash
# mkdir new_project; cd new_project
npm install actionhero
./node_modules/.bin/actionhero generate
npm start
```

Or spawn a web API server now:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/evantahler/actionhero)

## Want more?

- [Getting Started](http://www.actionherojs.com/docs/#getting-started)
- [Running actionhero](http://www.actionherojs.com/docs/#running-actionhero)
- [Read the documentation](http://www.actionherojs.com/docs)
- [Find community-based resources](https://github.com/l0oky/awesome-actionhero)
- [See a Sample Project (simple)](https://github.com/evantahler/actionhero-tutorial)
- [See a Sample Project (elaborate)](https://github.com/evantahler/actionhero-angular-bootstrap-cors-csrf)
- [View the release history](https://github.com/evantahler/actionhero/releases/)

## Documentation
Actionhero's documentation can be found @ [http://www.actionherojs.com/docs/](http://www.actionherojs.com/docs/).  If you want to contribute to these docs, visit the [site](https://github.com/evantahler/actionhero/tree/master/site) folder of this project with more instructions.

## Who?

* The primary creator of the actionhero framework is [Evan Tahler](http://evantahler.com), but many others [have helped](https://github.com/evantahler/actionhero/graphs/contributors)
* Logo by [Ali Spagnola](http://alispagnola.com/)
* If you want to contribute to actionhero, contribute to the conversation on [github](https://github.com/evantahler/actionhero)

###
