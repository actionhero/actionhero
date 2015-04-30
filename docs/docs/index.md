---
layout: docs
title: Documentation - Home
---
<img src="/img/logo/actionhero_400.png" width="300" />

# Who is the actionhero?

actionhero is a [node.js](http://nodejs.org) **API framework** for both **tcp sockets**, **web sockets**, and **http clients**.  The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  Clients connected to an actionhero server can **consume the api**, **consume static content**, and **communicate with each other**.

actionhero servers can process both requests and tasks (delayed actions like `send e-mail` or other background jobs).  actionhero servers can also run in a cluster (on the same or multiple machines) to work in concert to handle your load.

The actionhero API defines a single access point and accepts GET, POST, PUT and DELETE input along with persistent connection via TCP or web sockets. You define **Actions** which handle input and response, such as `userAdd` or `geoLocate`. HTTP, HTTPS, and TCP clients can all use these actions.  The actionhero API is not inherently "RESTful" (which is meaningless for persistent socket connections) but can be extended to be so if you wish.

actionhero will also serve static files for you, but actionhero is not a 'rendering' server (like express or rails).

# All Images

## actionhero sections
<img src="/img/actionheroGraphic.png" />

## request flow
<img src="/img/connection_flow.png" />

## cluster topology
<img src="/img/cluster.png" />

---

# Contributing

The actionherojs.com website and documentation is hosted on [GitHub Pages](http://pages.github.com/).  You can submit pull requests to the [gh-pages](https://github.com/evantahler/actionhero/tree/gh-pages) branch of the actionhero project.

# Notes
- This documentation will always reflect the master branch of actionhero, and therefore may be slightly ahead of the latest release on NPM.
