# Introduction

## Who is the actionhero?

```bash
> npm start

> actionhero@12.2.2 start /Users/evantahler/Projects/actionhero
> node ./bin/actionhero

info: actionhero >> start
2015-11-14 16:01:27 - notice: *** starting actionhero ***
2015-11-14 16:01:27 - info: actionhero member 10.0.1.15 has joined the cluster
2015-11-14 16:01:27 - notice: pid: 36087
2015-11-14 16:01:27 - notice: server ID: 10.0.1.15
2015-11-14 16:01:27 - info: ensuring the existence of the chatRoom: defaultRoom
2015-11-14 16:01:27 - info: ensuring the existence of the chatRoom: anotherRoom
2015-11-14 16:01:27 - notice: starting server: web
2015-11-14 16:01:27 - notice: starting server: websocket
2015-11-14 16:01:28 - notice: environment: development
2015-11-14 16:01:28 - notice: *** Server Started @ 2015-11-14 16:01:28 ***
```

actionhero is a [node.js](http://nodejs.org) **API framework** for both **tcp sockets**, **web sockets**, and **http clients**.  The goal of actionhero is to create an easy-to-use toolkit for making **reusable** & **scalable** APIs.  Clients connected to an actionhero server can **consume the api**, **consume static content**, and **communicate with each other**.

actionhero servers can process both requests and tasks (delayed actions like `send e-mail` or other background jobs).  actionhero servers can also run in a cluster (on the same or multiple machines) to work in concert to handle your load.

The actionhero API defines a single access point and accepts GET, POST, PUT and DELETE input along with persistent connection via TCP or web sockets. You define **Actions** which handle input and response, such as `userAdd` or `geoLocate`. HTTP, HTTPS, and TCP clients can all use these actions.  The actionhero API is not inherently "RESTful" (which is meaningless for persistent socket connections) but can be extended to be so if you wish.

actionhero will also serve static files for you, but actionhero is not a 'rendering' server (like express or rails).

## Contributing

The actionherojs.com website and documentation is hosted on [GitHub Pages](http://pages.github.com/).  You can submit pull requests to the [master branch's `docs` folder](https://github.com/evantahler/actionhero/tree/master/docs) within the actionhero project.

## Documentation Notes
This documentation will always reflect the master branch of actionhero, and therefore may be slightly ahead of the latest release on NPM.