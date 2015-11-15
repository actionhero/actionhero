# Initializers

Initializers are the main way you expand your actionhero server.  This is where you connect to databases, modify the global `api` object with new classes and helper methods, and set up your [middleware](docs#middleware).

Initializers run in 3 phases coinciding with the lifecycles of the application: `init`, `start`, and `stop`.  All `init` steps happen before all `start` steps.  Initializers can define both methods and priorities which will happen at each phase of the server's lifecycle.

System initializers (like setting up redis and the cache) have priority levels in the 100 to 1000 level range.  Application initializers should run with a priority level of over 1000 to use methods created by the system.  You can of course set priority levels lower than 1000 in your application (perhaps you connect to a database).  The priroity level split is purely convention.

In general, `initialize()` methods should create prototypes and new objects, and `start()` should boot things or connect to external resources.

## Format

```javascript
// initializers/stuffInit.js

module.exports = {
  loadPriority:  1000,
  startPriority: 1000,
  stopPriority:  1000,
  initialize: function(api, next){
    api.myObject = {};

    next();
  },
  start: function(api, next){
    // connect to server
    next();
  },
  stop: function(api, next){
    // disconnect from server
    next();
  }
}
```

To use a custom initializer, create a `initializers` directory in your project. Export an object with at least one of `start`, `stop` or `initialize` and specify your priorities.

You can generate a file of this type with `actionhero generateInitializer --name=stuffInit`

## Errors

You can pass an error to the callback of any step in the initializer.  Doing so will cause actionhero to log the error and stop the server.  For example, you might throw an error if you cannot connect to an external service at boot, [like a database](https://github.com/evantahler/ah-sequelize-plugin/blob/master/initializers/sequelize.js). 
