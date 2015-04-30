---
layout: docs
title: Documentation - Example Tasks
---

# Example Tasks

**[runAction](https://github.com/evantahler/actionhero/blob/master/tasks/runAction.js)**: This (non periodic) task is used to call an action in the background.  For example, you might have an action to `sendEmail` which can be called synchronously by a client, but you also might want to call it in a delayed manner.  This is the task for you!

**[sayHi](/docs/examples/tasks/sayHi.html)** A very simple example which will just log 'HELLO' to the command line every 5 seconds.

**[cleanLogFiles](/docs/examples/tasks/cleanLogFiles.html)**: This periodic task will run on all servers and inspect actionhero's `log` directly for large log files, and delete them

**[pingSocketClients](/docs/examples/tasks/pingSocketClients.html)**: This periodic task will run on all servers and send a 'ping' to any connected TCP clients to help them keep their
