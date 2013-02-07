# actionHero API Framework



**Links: [NPM](https://npmjs.org/package/actionHero) | [Wiki](https://github.com/evantahler/actionHero/wiki) | [API Methods](https://github.com/evantahler/actionHero/wiki/API-Methods) | [Public Site](http://www.actionherojs.com) | [GitHub](https://github.com/evantahler/actionHero) | [Mailing List](https://groups.google.com/forum/?fromgroups=#!forum/actionhero-js) | [Client](https://github.com/evantahler/actionhero_client)**

<img src="https://raw.github.com/evantahler/actionHero/master/public/logo/actionHero.png" height="300"/>

[![Nodejitsu Deploy Status Badges](https://webhooks.nodejitsu.com/evantahler/actionHero.png)](http://demo.actionherojs.com)

[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png?branch=master)](http://travis-ci.org/evantahler/actionHero)

## Who is the actionHero?
actionHero is a [node.js](http://nodejs.org) **API framework** for many types of clients.  The goal of actionHero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  clients connected to an actionHero server can [**consume the api**](https://github.com/evantahler/actionHero/wiki/Actions), [**consume static content**](https://github.com/evantahler/actionHero/wiki/File-Server), and [**communicate with each other**](https://github.com/evantahler/actionHero/wiki/Chat).

Currently actionHero supports:

- [Web Clients](https://github.com/evantahler/actionHero/wiki/Web-Clients): HTTP, HTTPS
- [Socket Clients](https://github.com/evantahler/actionHero/wiki/TCP-Clients): TCP (telnet), TLS
- [Web Socket (socket.io) clients](https://github.com/evantahler/actionHero/wiki/Web-Socket-Clients): HTTP, HTTPS

actionHero is ideal for large game projects (MMOs), heavily trafficked APIs, and even API-driver websites.  actionHero servers can process both requests and [tasks](https://github.com/evantahler/actionHero/wiki/Tasks) (delayed actions like `send e-mail` or other background jobs).  Taks can be enqued as a delayed job, or run periodically.  actionHero servers can also run in a cluster (on the [same](https://github.com/evantahler/actionHero/wiki/Running-ActionHero) or [multiple machines](https://github.com/evantahler/actionHero/wiki/actionCluster)) to work in concert to handle your load.  Tasks can be alocated to run on `any` or `all` of the servers in yoru cluster.

## Quick Start

  npm install actionHero
  ./node_modules/.bin/actionHero generate
  ./node_modules/.bin/actionHero start

## Want more?

- [Getting Started](https://github.com/evantahler/actionHero/wiki/Getting-Started)
- [Running actionHero](https://github.com/evantahler/actionHero/wiki/Running-ActionHero)
- [Read the documentation on the wiki](https://github.com/evantahler/actionHero/wiki)
- [Check out the project history](https://github.com/evantahler/actionHero/blob/master/versions.md)

## Who?
* The primary creator of the actionHero framework is [Evan Tahler](http://evantahler.com), but many others [have helped](https://github.com/evantahler/actionHero/graphs/contributors)
* Logo by [Ali Spagnola](http://alispagnola.com/)
* If you want to contribute to actionHero, contribute to the conversation on [github](https://github.com/evantahler/actionHero)

###
