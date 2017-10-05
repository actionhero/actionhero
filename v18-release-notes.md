# ActionHero v18: Async/Await

## Introduction

ActionHero has been entirely re-written to use the new `async/await` features available in Node.JS version 8.   

If you don't know about writing javascript code in the `async/await` style, [there are many resources online](https://hackernoon.com/6-reasons-why-javascripts-async-await-blows-promises-away-tutorial-c7ec10518dd9), but this is my favorite: [Explaining Async/Await in 7 seconds](https://twitter.com/manekinekko/status/855824609299636230) (you have time for this one!).  There are no more callbacks and no more promise chains.  You use try/catch to deal with errors.   You can use normal `for` and `while` loops to work on async methods.  The world is so much more pleasant!  Code is more readable, and bugs are far easier to find and test.

With the newer versions of node, we also get access to real class methods, which make extending and sharing code much easier.

For example, the run method of an action using `api.cache` used to look like:

```js
exports.cacheTest = {
  name: 'cacheTest',
  description: 'I will test the internal cache functions of the API',

  outputExample: {
    cacheTestResults: {
      //..
    }
  },

  inputs: {
    key: {
      required: true,
      formatter: function (s) { return String(s) }
    },
    value: {
      required: true,
      formatter: function (s) { return String(s) },
      validator: function (s) {
        if (s.length < 3) {
          return '`value` should be at least 3 letters long'
        } else { return true }
      }
    }
  },

  run: function (api, data, next) {
    const key = 'cacheTest_' + data.params.key
    const value = data.params.value

    data.response.cacheTestResults = {}

    api.cache.save(key, value, 5000, function (error, resp) {
      if (error) { return next(error) }
      data.response.cacheTestResults.saveResp = resp
      api.cache.size(function (error, numberOfCacheObjects) {
        if (error) { return next(error) }
        data.response.cacheTestResults.sizeResp = numberOfCacheObjects
        api.cache.load(key, function (error, resp, expireTimestamp, createdAt, readAt) {
          if (error) { return next(error) }
          data.response.cacheTestResults.loadResp = {
            key: key,
            value: resp,
            expireTimestamp: expireTimestamp,
            createdAt: createdAt,
            readAt: readAt
          }
          api.cache.destroy(key, function (error, resp) {
            data.response.cacheTestResults.deleteResp = resp
            next(error)
          })
        })
      })
    })
  }

}
```

But now, can be written simply as:

```js
const {Action, api} = require('./../index.js')

module.exports = class CacheTest extends Action {
  constructor () {
    super()
    this.name = 'cacheTest'
    this.description = 'I will test the internal cache functions of the API'
    this.outputExample = {
      //..
    }
  }

  inputs () {
    return {
      key: {
        required: true,
        formatter: this.stringFormatter,
        validator: this.stringValidator
      },

      value: {
        required: true,
        formatter: this.stringFormatter,
        validator: this.stringValidator
      }
    }
  }

  stringFormatter (s) {
    return String(s)
  }

  stringValidator (s) {
    if (s.length < 3) {
      return 'inputs should be at least 3 letters long'
    } else {
      return true
    }
  }

  async run ({params, response}) {
    const key = 'cacheTest_' + params.key
    const value = params.value

    response.cacheTestResults = {
      saveResp: await api.cache.save(key, value, 5000),
      sizeResp: await api.cache.size(),
      loadResp: await api.cache.load(key),
      deleteResp: await api.cache.destroy(key)
    }
  }
}
```

## The Many Breaking Changes

The ActionHero Core Team had to make a hard decision with this release.  This marks the first version we've released that **does not** work with all active LTS versions of Node.JS. Until now, this was our policy. However, We felt the gains in legibility, productivity, and debugging were so important that leaving 'legacy' users behind was the correct tradeoff.

However, to continue to support ActionHero users on v17, we will break with our other policy of only supporting "master".  We've cut a v17 branch, and will continue to accept patches and updates to it until March of 2018. We will also port any security fixes from master back to v17.  We know that upgrading to v18 (and perhaps a new version of Node.JS) will be the most difficult ActionHero migration to date, but I assure you it will be worth it!

I've also discussed these thoughts on the first ["Always bet on Node podcast"](https://twitter.com/dshaw/status/909565638443708417) with @dshaw and @mikeal and in [this]() blog post (forthcoming).

## API changes and Documentation: [docs.actionherojs.com](https://docs.actionherojs.com)

To ease the upgrade process (and help new users), we have annotated all public APIs, methods and classes within the ActionHero codebase with [jsDOC](http://usejsdoc.org).  This allows for a few wonderful things to happen:

* When viewing the source code, you can see documentation right next to where the method is defined!
* We can call out which methods are public, and expected to have a stable API (these are the documented ones), and which ones are private (`@priavte` or not documetned at all).
* We can build a new [docs.actionherojs.com](https://docs.actionherojs.com) website AUTOMATICALLY from the source code, and always ensure that it is up-to-date.  
* The above site will be included into the releases of ActionHero, and therefore you will always have access to the documentation for your version of ActionHero, even offline.

@gcoonrod has offered to back-port the new JSdoc documentation to the v17 branch of ActionHero, which is one of the ways we have committed to supporting this version of the project.

---

In a nutshell, the API changes can be described as follows:

### Node.js v8.0.0+ is required.

Using these new features requires node V8.x.x and later.  ActionHero will no longer be supporting node v4.x.x and v6.x.x.  In the future, we can investigate using Babel to transpile for earlier versions, but today, that is not supported.  

### There are no more callbacks.

Anything that used to have a callback, is now an `async` method which returns a response, and throws and error.  This includes the `run` method within actions and tasks.

Example:
```js
//old
await api.cache.load('myKey', (error, value) => {
  if (error) { return handleError(error) }  
  //...
})

// new
try {
  let value = await api.cache.load('myKey')
} catch (error) {
  api.log(error)
}
```

### You Extend ActionhHero

ll modules of ActionHero (`Actions`, `Tasks`, `Initializers`, `Servers` and, `CLI` commands) are all now classes which extend some a similarly named module from  ActionHero.  

#### Actions
```js
const {Action, api} = require('actionhero')

module.exports = class MyAction extends Action {
  constructor () {
    super()
    this.name = 'myAction'
    this.description = 'myAction'
    this.outputExample = {}
  }

  async run (data) {
    api.log('yay')
    // your logic here
  }
}
```

#### Tasks
```js
const {Task, api} = require('actionhero')

module.exports = class MyTask extends Task {
  constructor () {
    super()
    this.name = 'myTask'
    this.description = 'myTask'
    this.frequency = 0
  }

  async run (data) {
    api.log('yay')
    // your logic here
  }
}
```

This allows you to create your own classes which might share common inputs, middleware, or helper functions, ie: `MyAction extends AuthenticatedAction`, where `AuthenticatedAction extends ActionHero.Action`.

### You require the `api` object

Every method which used to supply the `api` object as an argument no longer does.  You now `const api = require('actionhero').api` wherever you need it.  This is helpful for a few reasons:

* Method signatures get cleaned up.
* You can require the api object once in an class, and use it for every method (no need to pass it between functions, or set `this.api = api`).
* You can reach the api object from helper files now.


### No more `fakeredis`

Support fakeredis is dropped.  In fact, the maintainer has stoped supporting it.  `ioredis` is now a required dependent package.  That said, if you don't need any of the redis features (cache, chat, pub/sub, tasks), you can disable them all with `api.config.redis.enabled = false` configuration option, and you can still boot an ActionHero server without redis.

### How to require plugins has changed

#### Remove `actionhero link` (and `actionhero unlink`) in favor of `config/plugins.js`
 Using linkfiles was brittle.  It didn't work with namespaced NPM packages, and struggled on windows computers.  We are returning to using a configuration file to define plugins which your application will load.  

```js
// config/plugins.js

// If you want to use plugins in your application, include them here:
return {
  'myPlugin': { path: __dirname + '/../node_modules/myPlugin' }
}

// You can also toggle on or off sections of a plugin to include (default true for all sections):
return {
  'myPlugin': {
    path: __dirname + '/../node_modules/myPlugin',
    actions: true,
    tasks: true,
    initializers: true,
    servers: true,
    public: true
  }
}
```

This also makes testing plugins much easier, as you can boot up an ActionHero server from within your plugin (if `actionhero` is a devDependancy) with the following:

```js
const path = require('path')
process.env.PROJECT_ROOT = path.join(__dirname, '..', 'node_modules', 'actionhero')
const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('My Plugin', () => {
  before(async () => {
    let configChanges = {
      plugins: {
        'testPlugin': { path: path.join(__dirname, '..') }
      }
    }

    api = await actionhero.start({configChanges})
  })

  after(async () => { await actionhero.stop() })

  it('does stuff', async () => {
    //...
  })
})
```

#### Add `actionhero generate plugin`
A helper which you can use in an empty directory which will create a template plugin project

#### Remove `api.utils.recursiveDirectoryGlob` in favor of the nom `glob` package.
We can use the standard package now that we no longer need to traverse custom ActionHero link files

## Other notes

* All dependent packages have been updated to their latest versions.
* ActionHero will no longer throw an error and exit if you override a core (or existing) initializer, action, task, etc.  We now log an error and allow it.
* A related change to Node Resque https://github.com/taskrabbit/node-resque/pull/212 is part of this update.
A related change to Browser Fingerprint https://github.com/actionhero/browser_fingerprint/releases/tag/v1.0.1 is part of this update.
* `ActionheroClient` (the included client library for browser websocket clients) as been named a more clear `ActionheroWebsocketClient` to avoid ambiguity.  The node sever-sever package has been renamed `actionhero-node-client` to help clear up any confusion.

## Thank you.

Thank you to everyone who helped make this release possible, especially @gcoonrod and @crrobinson14.
