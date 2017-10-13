## Overview

Initializers are the main way you expand your ActionHero server.  This is where you connect to databases, modify the global `api` object with new classes and helper methods, and set up your [middleware](/docs/core/middleware).

Initializers run in 3 phases coinciding with the lifecycles of the application: `init`, `start`, and `stop`.  All `init` steps happen before all `start` steps.  Initializers can define both methods and priorities which will happen at each phase of the server's lifecycle.

System initializers (like setting up redis and the cache) have priority levels in the 100 to 1000 level range.  Application initializers should run with a priority level of over 1000 to use methods created by the system.  You can of course set priority levels lower than 1000 in your application (perhaps you connect to a database).  The priority level split is purely convention.

In general, `initialize()` methods should create prototypes and new objects, and `start()` should boot things or connect to external resources.

## Format

```js
// initializers/stuffInit.js

const {ActionHero, api} = require('actionhero')

module.exports = class StuffInit extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'StuffInit'
    this.loadPriority = 1000
    this.startPriority = 1000
    this.stopPriority = 1000
  }

  async initialize () {
    api.StuffInit = {}
    api.StuffInit.startStuff = async () => {}
    api.StuffInit.stopStuff = async () => {}
  }

  async start () {
    await api.StuffInit.startStuff()
  }

  async stop () {
    await api.StuffInit.stopStuff()
  }
}
```

To use a custom initializer, create a `initializers` directory in your project. Export a class that extends `ActionHero.Initializer` and implements at least one of `start`, `stop` or `initialize` and specify your priorities.

You can generate a file of this type with `actionhero generate initializer --name=stuffInit`

## Errors

You can throw an error at any step in the initializer.  Doing so will cause ActionHero to log the error and stop the server.  For example, you might throw an error if you cannot connect to an external service at boot, [like a database](https://github.com/actionhero/ah-sequelize-plugin/blob/master/initializers/sequelize.js).