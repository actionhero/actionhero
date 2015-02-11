---
layout: docs
title: Documentation - Getting Started
---

## Getting Started with actionhero

## Requirements
* node.js ( >= v0.8.0)
* npm
* redis (for cluster support, cache, stats, and tasks)

## Install & Quickstart

**Get Started Now:**

{% highlight bash %}
npm install actionhero
./node_modules/.bin/actionhero generate
npm start
{% endhighlight %}

* Create a new directory `mkdir ~/project && cd ~/project`
* Checkout the actionhero source `npm install actionhero`
* Use the generator to create a template project `./node_modules/.bin/actionhero generate`
* You can now start up the server: `npm start`

Visit `http://127.0.0.1:8080/public` in your browser to see the actionhero in action!

You can also opt to install actionhero globally `npm install actionhero -g` and then you can just call `actionhero start`.
	
## Application Structure

Actions in `/actions` will be loaded in automatically, along `/initializers` and `/tasks`. `/public` will become your application's default static asset location.  The map below describes actionhero's default project layout.  If you wish to customize your project's paths, you can do so within `config/api.js` in the `api.config.general.paths` section

{% highlight bash %}
|- config
| -- api.js
| -- logger.js
| -- redis.js
| -- stats.js
| -- tasks.js
| -- servers
| ---- web.js
| ---- websocket.js
| ---- socket.js
|-- (project settings)
|
|- actions
|-- (your actions)
|
|- initializers
|-- (any additional initializers you want)
|
|- log
|-- (default location for logs)
|
|- node_modules
|-- (your modules, actionhero should be npm installed in here)
|
|- pids
|-- (pidfiles for your running servers)
|
|- public
|-- (your static assets to be served by /file)
|
|- servers
|-- (custom servers you may make)
|
|- tasks
|-- (your tasks)
|
|- tests
|-- (tests for your API)
|
readme.md
routes.js
gruntfile.js
package.json (be sure to include 'actionhero':'x')
{% endhighlight %}

## Tutorial
Want to see an example application using actionhero?  You can check out the code and follow the detailed guide [here](https://github.com/evantahler/actionhero-tutorial).  This project demonstrates many of the core features of actionhero in a simple project.
