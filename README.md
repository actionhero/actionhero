# ActionHero

## The reusable, scalable, and quick node.js API server for stateless and stateful applications

<div align="center">
  <img src="https://raw.github.com/actionhero/actionhero/master/public/logo/actionhero-small.png" alt="ActionHero Logo" />
</div>

***

<div align="center">

**[NPM](https://npmjs.org/package/actionhero) |
[Web Site](https://www.actionherojs.com) |
[Latest Docs](https://docs.actionherojs.com) |
[GitHub](https://github.com/actionhero/actionhero) |
[Slack](https://slack.actionherojs.com) |
[Twitter](https://twitter.com/actionherojs)**

</div>

***

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/actionhero.svg?style=flat-square)](https://www.npmjs.com/package/actionhero)
[![Node Version](https://img.shields.io/node/v/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![NPM](https://img.shields.io/npm/dm/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![Dependency Status](https://david-dm.org/actionhero/actionhero.svg?style=flat-square)](https://david-dm.org/actionhero/actionhero)
[![Greenkeeper badge](https://badges.greenkeeper.io/actionhero/actionhero.svg)](https://greenkeeper.io/)
[![Build Status](https://circleci.com/gh/actionhero/actionhero.png)](https://circleci.com/gh/actionhero/actionhero)
[![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/l0oky/awesome-actionhero)
[![Chat](https://slack.actionherojs.com/badge.svg)](http://slack.actionherojs.com)

</div>

***

## Who is the ActionHero?
ActionHero is a multi-transport API Server with integrated cluster capabilities and delayed tasks. The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs for HTTP, WebSockets, and more.  Clients connected to an actionhero server can [**consume the api**](https://docs.actionherojs.com/tutorial-actions.html), [**consume static content**](https://docs.actionherojs.com/tutorial-file_server.html), and [**communicate with each other**](https://docs.actionherojs.com/tutorial-chat.html).  ActionHero is cluster-ready, with built in support for background tasks, 0-downtime deploys, and more.  ActionHero provides a simple Async/Await API for managing every type of connection and background task.

Currently actionhero supports the following out of the box...

- [Web Clients](https://docs.actionherojs.com/tutorial-web.html): HTTP, HTTPS
- [Socket Clients](https://docs.actionherojs.com/tutorial-socket.html): TCP (telnet), TLS
- [Web Socket Clients](https://docs.actionherojs.com/tutorial-web_socket.html): HTTP, HTTPS

[... and you can also make your own servers and transports.](https://docs.actionherojs.com/ActionHero.Server.html)

## Quick Start
```bash
# mkdir new_project; cd new_project
npm install actionhero
./node_modules/.bin/actionhero generate
npm start
```

Your new project will come with example actions, tests, and more.

Or deploy a free API server now:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/actionhero/actionhero)

## Want more?

- [Getting Started](https://www.actionherojs.com/get-started)
- [Read the documentation](http://docs.actionherojs.com/)
- [Find community-based resources](https://github.com/l0oky/awesome-actionhero)
- [Interact with the Community & View the Release History](https://www.actionherojs.com/community)
- [Server Client](https://github.com/actionhero/actionhero-client)

## Sample Projects
- [Simple](https://github.com/actionhero/actionhero-tutorial)
- [Elaborate (Angular, Sequelize)](https://github.com/actionhero/actionhero-angular-bootstrap-cors-csrf)
- [Client Use: React](https://github.com/actionhero/actionhero-react-next-chat)
- [Client Use: React Native](https://github.com/actionhero/actionhero-react-native)

## Documentation
- Starting with ActionHero version 18, the documentation for each version is included in this repository (and the NPM package) in the `/docs` folder.  The current version of this documenation is also automatically deployed to https://docs.actionherojs.com.
- ActionHero's marketing site can be found @ [https://github.com/actionhero/www.actionherojs.com/](https://github.com/actionhero/www.actionherojs.com/).  If you want to contribute to this site, visit the [related project](https://github.com/actionhero/www.actionherojs.com)

## Who?

* The primary creator of the actionhero framework is [Evan Tahler](http://evantahler.com), but many others [have helped](https://github.com/actionhero/actionhero/graphs/contributors)
* If you want to contribute to actionhero, contribute to the conversation on [github](https://github.com/actionhero/actionhero) and join us on [slack](https://slack.actionherojs.com)
