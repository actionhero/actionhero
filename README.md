# ActionHero

*The reusable, scalable, and quick node.js API server for stateless and stateful applications*

<div align="center">
  <img src="https://raw.github.com/actionhero/actionhero/master/public/logo/actionhero-small.png" alt="ActionHero Logo" />
</div>

<div align="center" class="topLinks">

**[NPM](https://npmjs.org/package/actionhero) |
[Web Site](https://www.actionherojs.com) |
[Latest Docs](https://docs.actionherojs.com) |
[GitHub](https://github.com/actionhero/actionhero) |
[Slack](https://slack.actionherojs.com) |
[Twitter](https://twitter.com/actionherojs)**

</div>

<div align="center" class="topBadges">

[![NPM Version](https://img.shields.io/npm/v/actionhero.svg?style=flat-square)](https://www.npmjs.com/package/actionhero)
[![Node Version](https://img.shields.io/node/v/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![NPM](https://img.shields.io/npm/dm/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![Dependency Status](https://david-dm.org/actionhero/actionhero.svg?style=flat-square)](https://david-dm.org/actionhero/actionhero)
[![Greenkeeper badge](https://badges.greenkeeper.io/actionhero/actionhero.svg)](https://greenkeeper.io/)
[![Build Status](https://circleci.com/gh/actionhero/actionhero.png)](https://circleci.com/gh/actionhero/actionhero)
[![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/l0oky/awesome-actionhero)
[![Chat](https://slack.actionherojs.com/badge.svg)](http://slack.actionherojs.com)

</div>

## ActionHero v18

ActionHero v18 is the `async/await` Node.js framework you have been waiting for!

ActionHero version 18 has many *significant and breaking* changes from previous versions.  Please read the [Release notes](https://github.com/actionhero/actionhero/releases/tag/v18.0.0) and [Upgrade Guide](https://docs.actionherojs.com/tutorial-upgrade-path.html)

## Who is the ActionHero?
ActionHero is a multi-transport API Server with integrated cluster capabilities and delayed tasks. The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs for HTTP, WebSockets, and more.  Clients connected to an actionhero server can [**consume the api**](https://docs.actionherojs.com/tutorial-actions.html), [**consume static content**](https://docs.actionherojs.com/tutorial-file_server.html), and [**communicate with each other**](https://docs.actionherojs.com/tutorial-chat.html).  ActionHero is cluster-ready, with built in support for background tasks, 0-downtime deploys, and more.  ActionHero provides a simple Async/Await API for managing every type of connection and background task.

Currently actionhero supports the following out of the box...

- [Web Clients](https://docs.actionherojs.com/tutorial-web-server.html): HTTP, HTTPS
- [Socket Clients](https://docs.actionherojs.com/tutorial-socket-server.html): TCP (telnet), TLS
- [Web Socket Clients](https://docs.actionherojs.com/tutorial-web_socket.html): HTTP, HTTPS

[... and you can also make your own servers and transports.](https://docs.actionherojs.com/ActionHero.Server.html)

## Quick Start
```bash
# mkdir new_project; cd new_project
npm install actionhero
npx actionhero generate
npm start
```

Your new project will come with example actions, tests, and more.

Or deploy a free API server now:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/actionhero/actionhero)

## Learn More

- [Getting Started @ www.actionherojs.com](https://www.actionherojs.com/get-started)
  - ActionHero's marketing site can be found @ [https://github.com/actionhero/www.actionherojs.com/](https://github.com/actionhero/www.actionherojs.com/).  If you want to contribute to this site, visit the [related project](https://github.com/actionhero/www.actionherojs.com)
- [Read the documentation @ docs.actionherojs.com](http://docs.actionherojs.com/)
  - Starting with ActionHero version 18, the documentation for each version is included in this repository (and the NPM package) in the `/docs` folder.  The current version of this documentation is also automatically deployed to https://docs.actionherojs.com.
- [Find community-based resources](https://github.com/l0oky/awesome-actionhero)
- [Interact with the Community & View the Release History](https://www.actionherojs.com/community)
- [Server Client](https://github.com/actionhero/actionhero-client)

## In-depth Tutorials

### Core Components
- [Actions](https://docs.actionherojs.com/tutorial-actions.html)
- [Tasks](https://docs.actionherojs.com/tutorial-tasks.html)
- [Middleware](https://docs.actionherojs.com/tutorial-middleware.html)
- [Initializers](https://docs.actionherojs.com/tutorial-initializers.html)
- [CLI Commands](https://docs.actionherojs.com/tutorial-cli.html)
- [Configuration](https://docs.actionherojs.com/tutorial-config.html)
- [Cluster](https://docs.actionherojs.com/tutorial-cluster.html)
- [Chat & Realtime Communication](https://docs.actionherojs.com/tutorial-chat.html)
- [File Server](https://docs.actionherojs.com/tutorial-file-server.html)
- [Logging](https://docs.actionherojs.com/tutorial-logging.html)
- [Plugins](https://docs.actionherojs.com/tutorial-plugins.html)
- [Servers](https://docs.actionherojs.com/tutorial-servers.html)
- [Localization & Translation](https://docs.actionherojs.com/tutorial-localization.html)

### Server Types
- [Web Server & Routes](https://docs.actionherojs.com/tutorial-web-server.html)
- [Socket Server](https://docs.actionherojs.com/tutorial-socket-server.html)
- [WebSocket Server](https://docs.actionherojs.com/tutorial-websocket-server.html)

### Testing, Deployment, and Operations
- [Running ActionHero](https://docs.actionherojs.com/tutorial-running-actionhero.html)
- [Development Mode & REPL](https://docs.actionherojs.com/tutorial-development-mode.html)
- [Testing & SpecHelper](https://docs.actionherojs.com/tutorial-testing.html)
- [Production Notes](https://docs.actionherojs.com/tutorial-production-notes.html)
- [Upgrade Path](https://docs.actionherojs.com/tutorial-upgrade-path.html)

## Sample Projects
- [Simple](https://github.com/actionhero/actionhero-tutorial)
- [Elaborate (Angular, Sequelize)](https://github.com/actionhero/actionhero-angular-bootstrap-cors-csrf)
- [Client Use: React](https://github.com/actionhero/actionhero-react-next-chat)
- [Client Use: React Native](https://github.com/actionhero/actionhero-react-native)

## Who?

* Many folks [have helped](https://github.com/actionhero/actionhero/graphs/contributors) to make ActionHero a reality.
* If you want to contribute to actionhero, contribute to the conversation on [github](https://github.com/actionhero/actionhero) and join us on [slack](https://slack.actionherojs.com)
