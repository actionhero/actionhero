# actionHero API Framework

[![Build Status](https://secure.travis-ci.org/evantahler/actionHero.png?branch=master)](http://travis-ci.org/evantahler/actionHero)

Links: [NPM](https://npmjs.org/package/actionHero) | [Wiki](https://github.com/evantahler/actionHero/wiki) | [Public Site](http://www.actionherojs.com) | [GitHub](https://github.com/evantahler/actionHero) | [Client](https://github.com/evantahler/actionhero_client)

<img src="https://raw.github.com/evantahler/actionHero/master/public/logo/actionHero.png" height="250"/>

## Who is the actionHero?
actionHero is a [node.js](http://nodejs.org) **API framework** for both **tcp sockets**, **web sockets**, and **http clients**.  The goal of actionHero are to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  clients connected to an actionHero server can **consume the api**, **consume static content**, and **communicate with each other**.

actionHero servers can process both requests and tasks (delayed actions like `send e-mail` or other background jobs).  actionHero servers can also run in a cluster (on the same or multiple machines) to work in concert to handle your load.

The actionHero API defines a single access point and accepts GET, POST, PUT and DELETE input along with persistent connection via TCP or web sockets. You define **Actions** which handle input and response, such as "userAdd" or "geoLocate". HTTP, HTTPS, and TCP clients can all use these actions.  The actionHero API is not inherently "RESTful" (which is meaningless for persistent socket connections) but can be extended to be so if you wish.

actionHero will also serve static files for you, but actionHero is not meant to be a 'rendering' server (like express or rails).

## Quick Start

	mkdir ~/my-action-hero-project && cd ~/my-action-hero-project
	npm install actionHero
	npm run-script actionHero generate
	npm start

## Want more?

- ### [Read the documentation on the wiki](https://github.com/evantahler/actionHero/wiki)
- ### [Check out the project history](https://github.com/evantahler/actionHero/blob/master/versions.md)

## Who?
* The primary creator of the actionHero framework is [Evan Tahler](http://evantahler.com)
* If you want to contribute to actionHero, contribute to the conversation on [github](https://github.com/evantahler/actionHero)

###
