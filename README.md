# Actionhero

_The reusable, scalable, and quick node.js API server for stateless and stateful applications_

---

<div align="center">
  <img src="https://raw.github.com/actionhero/actionhero/master/public/logo/actionhero-small.png" alt="Actionhero Logo" />
</div>

<br />

<div align="center" class="topLinks">

**[NPM](https://npmjs.org/package/actionhero) |
[Web Site](https://www.actionherojs.com) |
[Latest Docs](https://docs.actionherojs.com) |
[GitHub](https://github.com/actionhero/actionhero) |
[Slack](https://slack.actionherojs.com) |
[Twitter](https://twitter.com/actionherojs)**

</div>

<br />

<div align="center" class="topBadges">

[![NPM Version](https://img.shields.io/npm/v/actionhero.svg?style=flat-square)](https://www.npmjs.com/package/actionhero)
[![Node Version](https://img.shields.io/node/v/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![NPM](https://img.shields.io/npm/dm/actionhero.svg?style=flat-square)](https://npmjs.org/package/actionhero)
[![Dependency Status](https://david-dm.org/actionhero/actionhero.svg?style=flat-square)](https://david-dm.org/actionhero/actionhero)
![Test](https://github.com/actionhero/actionhero/workflows/Test/badge.svg)
[![Chat](https://slack.actionherojs.com/badge.svg)](http://slack.actionherojs.com)

</div>

## Who is the Actionhero?

Actionhero is a multi-transport API Server with integrated cluster capabilities and delayed tasks. The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs for HTTP, WebSockets, and more. Clients connected to an actionhero server can [**consume the api**](https://www.actionherojs.com/tutorials/actions), [**consume static content**](https://www.actionherojs.com/tutorials/file-server), and [**communicate with each other**](https://www.actionherojs.com/tutorials/chat). Actionhero is cluster-ready, with built in support for background tasks, 0-downtime deploys, and more. Actionhero provides a simple Async/Await API for managing every type of connection and background task.

Currently actionhero supports the following out of the box...

- [Web Clients](https://www.actionherojs.com/tutorials/web-server): HTTP, HTTPS
- [Web Socket Clients](https://www.actionherojs.com/tutorials/websocket-server): HTTP, HTTPS

[... and you can also make your own servers and transports.](https://www.actionherojs.com/tutorials/servers)

## Quick Start

```bash
# Generate a new Project
npx actionhero generate
npm install
npm run build
npm run dev # <-- I automatically notice changes and restart, as well as compiling .ts files

# Use the actionhero CLI
(npx) actionhero generate action --name my_action
(npx) actionhero generate task --name my_task --queue default --frequency 0

# Test
npm test

# To deploy your app
npm run build
npm run start
```

Your new project will come with example actions, tests, and more.

Or deploy a free API server now:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/actionhero/actionhero)

## Learn More 📚

- [Getting Started @ www.actionherojs.com](https://www.actionherojs.com/get-started)
  - Actionhero's website can be found @ [https://github.com/actionhero/www.actionherojs.com/](https://github.com/actionhero/www.actionherojs.com/). If you want to contribute to this site, visit the [related project](https://github.com/actionhero/www.actionherojs.com)
  - ---> Start with the [Tutorials](https://www.actionherojs.com/tutorials) <---
- [Read the typedoc documentation @ docs.actionherojs.com](http://docs.actionherojs.com/)
  - Starting with Actionhero version 18, the documentation for each version is included in this repository (and the NPM package) in the `/docs` folder. The current version of this documentation is also automatically deployed to https://docs.actionherojs.com.
- [Find community-based resources](https://github.com/l0oky/awesome-actionhero)
- [Interact with the Community & View the Release History](https://www.actionherojs.com/community)
- [Server Client](https://github.com/actionhero/actionhero-client)

## In-depth Tutorials 🎓

### Core Components

- [Actions](https://www.actionherojs.com/tutorials/actions)
- [Tasks](https://www.actionherojs.com/tutorials/tasks)
- [Middleware](https://www.actionherojs.com/tutorials/middleware)
- [Initializers](https://www.actionherojs.com/tutorials/initializers)
- [CLI Commands](https://www.actionherojs.com/tutorials/cli)
- [Configuration](https://www.actionherojs.com/tutorials/config)
- [Cluster](https://www.actionherojs.com/tutorials/cluster)
- [Chat & Realtime Communication](https://www.actionherojs.com/tutorials/chat)
- [File Server](https://www.actionherojs.com/tutorials/file-server)
- [Logging](https://www.actionherojs.com/tutorials/logging)
- [Plugins](https://www.actionherojs.com/tutorials/plugins)
- [Servers](https://www.actionherojs.com/tutorials/servers)
- [Localization & Translation](https://www.actionherojs.com/tutorials/localization)

### Server Types

- [Web Server & Routes](https://www.actionherojs.com/tutorials/web-server)
- [WebSocket Server](https://www.actionherojs.com/tutorials/websocket-server)

### Testing, Deployment, and Operations

- [Running Actionhero](https://www.actionherojs.com/tutorials/running-actionhero)
- [Development Mode & REPL](https://www.actionherojs.com/tutorials#configuration)
- [Testing & SpecHelper](https://www.actionherojs.com/tutorials/testing)
- [Production Notes](https://www.actionherojs.com/tutorials/production-notes)
- [Upgrade Path](https://www.actionherojs.com/tutorials/upgrade-path)

## Sample Projects

- [Simple](https://github.com/actionhero/actionhero-tutorial)
- [Elaborate (React, Next.JS, Bootstrap, Sequelize)](https://github.com/actionhero/actionhero-chat)
- [Client Use: React](https://github.com/actionhero/actionhero-react-next-chat)
- [Client Use: React Native](https://github.com/actionhero/actionhero-react-native)

## Who?

- Many folks [have helped](https://github.com/actionhero/actionhero/graphs/contributors) to make Actionhero a reality.
- If you want to contribute to actionhero, contribute to the conversation on [github](https://github.com/actionhero/actionhero) and join us on [slack](https://slack.actionherojs.com)

Thank you to all of Actionhero's contributors!

![image of contributors](https://contrib.rocks/image?repo=actionhero/actionhero)

## Contributing

- Contributing to Actionhero is easy! [You can learn more about contributing to Actionhero here](https://github.com/actionhero/actionhero/blob/master/.github/CONTRIBUTING.md)
- By engaging the with Actionhero community or contributing to this or related projects, you agree to our [Code of Conduct](https://github.com/actionhero/actionhero/blob/master/CODE_OF_CONDUCT.md)

## License

[Apache 2.0](https://github.com/actionhero/actionhero/blob/master/LICENSE.txt)

## Dedication

> Technology is a powerful force in our society. Data, software, and communication can be used for bad: to entrench unfair power structures, to undermine human rights, and to protect vested interests. But they can also be used for good: to make underrepresented people’s voices heard, to create opportunities for everyone, and to avert disasters. This project is dedicated to everyone working toward the good.
>
> > Inspired by Martin Kleppmann

