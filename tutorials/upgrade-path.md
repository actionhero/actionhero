![](documentation.svg)

## Overview

Upgrading big ActionHero projects to a new major might require some effort. Every ActionHero version has it's own specific project files which you generate using `actionhero generate` command.

One of the ways to upgrade your project is to generate a new project using the latest ActionHero framework (`npm install actionhero && npx actionhero generate`). Using that as your starting point you can then carefully copy all your `configs`, `initializers`, `servers`, `tasks`, `actions`, and other custom code from your old project, making sure that you are at the same working state as before. It's a good practice to make tests for your actions (or any other component) before you plan to upgrade your ActionHero project.

With good [test coverage](tutorial-testing.html) you can make sure that you have successfully upgraded your project.

ActionHero follows [semantic versioning](http://semver.org/). This means that a minor change is a right-most number. A new feature added is the middle number, and a breaking change is the left number. You should expect something in your application to need to be changed if you upgrade a major version.

## Upgrading from v17 to v18

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v18.0.0)**

**Breaking Changes and How to Overcome Them:**

There are *many* changes to the APIs actionhero exposes.  You can read up on the new syntax on our [new documentation website, docs.actionherojs.com](https://docs.actionherojs.com)

* **Node.js version**
  * Node.js v8 and higher is now required.  You must update your projects.

* **Actions**
  * Actions are now ES6 classes, which extend `require('actionhero').Action`.
  * The `run` method only has one argument now, `data` and becomes a `async` method.  `api` can be required globally to your file.

```js
const {Action, api} = require('actionhero')

module.exports = class MyAction extends Action {
 constructor () {
   super()
   this.name = 'randomNumber'
   this.description = 'I am an API method which will generate a random number'
   this.outputExample = {randomNumber: 0.1234}
 }

 async run (data) {
   data.response.randomNumber = Math.random()
 }
}
```

* **Tasks**
  * Tasks are now ES6 classes, which extend `require('actionhero').Task`.
  * The `run` method only has one argument now, `data` and becomes a `async` method.  `api` can be required globally to your file.

```js
const {api, Task} = require('actionhero')

module.exports = class SendWelcomeMessage extends Task {
  constructor () {
    super()
    this.name = 'SendWelcomeEmail'
    this.description = 'I send the welcome email to new users'
    this.frequency = 0
    this.queue = 'high'
    this.middleware = []
  }

  async run (data) {
    await api.sendWelcomeEamail({address: data.email})
    return true
  }
}
```

* **Initializers**
  * Initializers are now ES6 classes, which extend `require('actionhero').Initializer`.
  * The `initialize`, `start`, and `stop` methods now have no arguments and become a `async` methods.  `api` can be required globally to your file.

```js
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
    api.StuffInit.doAThing = async () => {}
    api.StuffInit.stopStuff = async () => {}
    api.log('I initialized', 'debug', this.name)
  }

  async start () {
    await api.StuffInit.startStuff()
    api.log('I started', 'debug', this.name)
  }

  async stop () {
    await api.StuffInit.stopStuff()
    api.log('I stopped', 'debug', this.name)
  }
}
```

* **Servers**
  * Servers are now ES6 classes, which extend `require('actionhero').Server`.
  * The `initialize`, `start`, and `stop` methods now have no arguments and become a `async` methods.  `api` can be required globally to your file.

```js
const ActionHero = require('actionhero')

module.exports = class MyServer extends ActionHero.Server {
  constructor () {
    super()
    this.type = '%%name%%'

    this.attributes = {
      canChat: false,
      logConnections: true,
      logExits: true,
      sendWelcomeMessage: false,
      verbs: []
    }
    // this.config will be set to equal api.config.servers[this.type]
  }

  initialize () {
    this.on('connection', (conection) => {

    })

    this.on('actionComplete', (data) => {

    })
  }

  start () {
    // this.buildConnection (data)
    // this.processAction (connection)
    // this.processFile (connection)
  }

  stop () {

  }

  sendMessage (connection, message, messageCount) {

  }

  sendFile (connection, error, fileStream, mime, length, lastModified) {

  }

  goodbye (connection) {

  }
}
```

* **CLI Commands**
  * CLI Commands are now ES6 classes, which extend `require('actionhero').CLI`.
  * The `run` method now has one argument, `data` and becomes a `async` method.  `api` can be required globally to your file.

```js
const {api, CLI} = require('actionhero')

module.exports = class RedisKeys extends CLI {
  constructor () {
    super()
    this.name = 'redis keys'
    this.description = 'I list all the keys in redis'
    this.example = 'actionhero keys --prefix actionhero'
  }

  inputs () {
    return {
      prefix: {
        requried: true,
        default: 'actionhero',
        note: 'the redis prefix for searching keys'
      }
    }
  }

  async run ({params}) => {
    let keys = await api.redis.clients.client.keys(params.prefix)
    api.log('Found ' + keys.length + 'keys:')
    keys.forEach((k) => { api.log(k) })
  }
}
```

* **Cache**
  * All methods which used to return a callback are now `async` methods which, when `await`ed, return a result and `throw` errors

* **Tasks**
  * All methods which used to return a callback are now `async` methods which, when `await`ed, return a result and `throw` errors

* **Chat**
  * All methods which used to return a callback are now `async` methods which, when `await`ed, return a result and `throw` errors

* **SpecHelper**
  * All methods which used to return a callback are now `async` methods which, when `await`ed, return a result and `throw` errors

```js
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const path = require('path')
const ActionHero = require('actionhero')
const actionhero = new ActionHero.Process()
let api

describe('Action: RandomNumber', () => {
  before(async () => { api = await actionhero.start() })
  after(async () => { await actionhero.stop() })

  let firstNumber = null
  it('generates random numbers', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
    firstNumber = randomNumber
  })

  it('is unique / random', async () => {
    let {randomNumber} = await api.specHelper.runAction('randomNumber')
    expect(randomNumber).to.be.at.least(0)
    expect(randomNumber).to.be.at.most(1)
    expect(randomNumber).not.to.equal(firstNumber)
  })
})
```

* **Utils**
  * `api.utils.recursiveDirectoryGlob` has been removed in favor of the [glob package](https://github.com/isaacs/node-glob). Use this instead.
  * All methods which used to return a callback are now `async` methods which, when `await`ed, return a result and `throw` errors

* **Plugins**
  * ActionHero no longer uses linkfiles to find plugins.  If you have any in a `plugins` directory in your actions, tasks, config, or public folders, delete them.
  * Plugins now need to be defined explicitly in a new `./config/plugins.js` config file.  You should create one [per the example](https://github.com/actionhero/actionhero/blob/master/config/plugins.js)
  * Removed `actionhero link` and `actionhero unlink` per the above.
  * Added `actionhero generate plugin`, a helper which you can use in an empty directory which will create a template plugin project
  * Testing plugins is now simpler.  [Read more about this on docs.actionherojs.com](https://docs.actionherojs.com/tutorial-plugins.html)

* **Clients**
  * `ActionheroClient` (the included client library for browser websocket clients) as been named a more clear `ActionheroWebsocketClient` to avoid ambiguity.  
  * The node sever-sever package has been renamed `actionhero-node-client` to help clear up any confusion.

## Upgrading from v16 to v17

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v17.0.0)**

**Breaking Changes and How to Overcome Them:**

*   **Localization (i18n)**

*   In `./config/i18n.js` be sure to enable `objectNotation`, or else the new locale file will be gibberish to ActionHero
*   As of this release, ActionHero no longer localizes its log messages. This is done to simplify and speed up the logger methods. There is not mitigation path here without overwriting the `api.log()` method.

*   Any use of `%` interpolation should be removed from your logger strings. Favor native JS string templates.

*   ActionHero now ships with locale files by default.

*   You will need to acquire the [default locale file](https://github.com/actionhero/actionhero/blob/master/locales/en.json) and copy it into `./locales/en.json` within your project.
*   The error reporters have all been changed to use these new locale file and mustache-style syntax. Update your from the [default errors file](https://github.com/actionhero/actionhero/blob/master/config/errors.js)
*   The `welcomeMessage` and `goodbyeMessage` are removed from the config files and ActionHero now refrences the locale files for these strings. Update yours accodingly.

*   **utils**

*   `api.utils.recursiveDirectoryGlob` has been removed in favor of the [glob package](https://github.com/isaacs/node-glob). Use this instead.

## Upgrading from v15 to v16

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v16.0.0)**

**Breaking Changes and How to Overcome Them:**

The only breaking changes are related to the capilization of internal methods:

*   `api.Connecton()` rather than `api.connection()`
*   `api.GenericServer()` rather than `api.genericServer()`
*   `api.ActionProcessor()` rather than `api.actionProcessor()`
*   `require('actionhero')` not `require('actionhero').actionheroPrototype` should you be using ActionHero programatically.

## Upgrading from v14 to v15

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v15.0.0)**

**Breaking Changes and How to Overcome Them:**

```bash
\`actionhero generateAction --name=[name]\`      -> \`actionhero generate action --name=[name]\`
\`actionhero generateInitializer --name=[name]\` -> \`actionhero generate initializer --name=[name]\`
\`actionhero generateServer --name=[name]\`      -> \`actionhero generate server --name=[name]\`
\`actionhero generateTask --name=[name]\`        -> \`actionhero generate task --name=[name]\`
```

*   The ActionHero binary has had it's commands changed.
    *   Any deployment or automation tools you use will need to be updated accordingly.
*   Tasks now use middleware instead of plugins.
    *   You will need to convert all uses of task plugins to task middleware.

## Upgrading from v13 to v14

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v14.0.0)**

**Breaking Changes and How to Overcome Them:**

*   Redis Client Configurations have changed drastically. This allows for greater configuration, but at a complexity cost.
    *   The easiest way to upgrade your `config/redis.js` is to take if from the [master branch](https://github.com/actionhero/actionhero/blob/master/config/redis.js) directly and re-apply your configuration.
    *   Move `api.config.redis.channel` to `api.config.general.channel`
    *   Move `api.config.redis. rpcTimeout` to `api.config.general.rpcTimeout`
    *   Throughout the code, use `api.config.redis.client` rather than `api.redis.client`

## Upgrading from v12 to v13

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v13.0.0)**

**Breaking Changes and How to Overcome Them:**

*   Pluggins
    *   `config/plugins.js` is removed. Delete yours.
    *   Use the new binary command, `actionhero link --name=NameOfPlugin` to link your plugins in the new method.
    *   Linking plugins will likley create new config files you may need to customize.
*   Locales
    *   This release introduced Locales. You will need the new locale config file. The easiest way to upgrade your `config/i18n.js` is to take if from the [master branch](https://github.com/actionhero/actionhero/blob/master/config/i18n.js).
    *   Ensure that `api.config.i18n.updateFiles` is `true` so that your locale files can be generated for the first time.
*   Errors
    *   `config/errors.js` has been completely redone to take advantage of `connection.localize`. The easiest way to upgrade your `config/errors.js` is to take if from the [master branch](https://github.com/actionhero/actionhero/blob/master/config/errors.js).
*   Grunt Removed
    *   Grunt is removed from the project. The old ActionHero grunt commands have been moved into the ActionHero binary.
*   Redis configuration
    *   `package` is a reserved keyword in JavaScript. We now use the key `pkg` in the redis config.

## Upgrading from v11 to v12

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v12.0.0)**

**Breaking Changes and How to Overcome Them:**

*   Redis configuration
    *   Switch from using the `redis` npm pacakge to `ioredis`. Change this in your package.json.
*   `ioredis` handles passwords slightly differently. Read the [ioredis](https://github.com/luin/ioredis) documentation to learn more.
*   Stats Removed
    *   The `api.stats` subsection has been removed from actionhero
    *   If you need the stats subsection, you can get get it [via plugin](https://github.com/actionhero/ah-stats-plugin)

## Upgrading from v10 to v11

**Full Release Notes: [GitHub](https://github.com/actionhero/actionhero/releases/tag/v11.0.0)**

**Breaking Changes and How to Overcome Them:**

*   Action Syntax changed
    *   `run: function(api, data, next){
          data.response.randomNumber = Math.random();
          next(error);
        }`
    *   Where data contains:
    *   `data = {
           connection: connection,
           action: 'randomNumber',
           toProcess: true,
           toRender: true,
           messageCount: 123,
           params: { action: 'randomNumber', apiVersion: 1 },
           actionStartTime: 123,
           response: {},
        }`
    *   You will need to change all of your actions to use `data.connection` rather than `connection` directly.
    *   You will need to change all of your actions to use `data.response` rather than `connection.response` directly.
*   Middleware syntax has changed to match action's `data` pattern. You will need to change your middleware accordingly.
*   Removed `connection._originalConnection`.
*   Websockets:
    *   The params of websocket connections should NOT be sticky. All actions will start with `connection.params = {}`. If you rely on the old behavior, you will need to change your client code.
*   Action Processor:
    *   Removed duplicate callback prevention in ActionProcessor. This belongs on the user/implementer to handle.
