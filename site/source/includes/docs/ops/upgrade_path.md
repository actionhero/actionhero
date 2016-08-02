# Upgrading ActionHero

Upgrading big ActionHero projects to a new major might require some effort. Every ActionHero version has it's own specific project files which you generate using `actionhero generate` command. One of the ways to upgrade your project is to generate a new project using the latest ActionHero framework (`npm install actionhero && ./node_modules/.bin/actionhero generate`). Using that as your starting point you can then carefully copy all your `configs`, `initializers`, `servers`, links and other custom code from your old project, making sure that you are at the same working state as before. It's a good practice to make tests for your actions (or any other component) before you plan to upgrade your ActionHero project.

With good [test coverage](http://www.actionherojs.com/docs/#testing) you can make sure that you have successfully upgraded your project.

ActionHero follows [semantic versioning](http://semver.org/).  This means that a minor change is a right-most number.  A new feature added is the middle number, and a breaking change is the left number.  You should expect something in your application to need to be changed if you upgrade a major version.

## Upgrading from v14.x.x to v15.x.x
**Full Release Notes: [GitHub](https://github.com/evantahler/actionhero/releases/tag/v15.0.0)**

**Breaking Changes and How to Overcome Them:**

- The ActionHero binary has had it's commands changed.  
  - Any deployment or automation tools you use will need to be updated accordingly.
```
`actionhero generateAction --name=[name]`      -> `actionhero generate action --name=[name]`
`actionhero generateInitializer --name=[name]` -> `actionhero generate initializer --name=[name]`
`actionhero generateServer --name=[name]`      -> `actionhero generate server --name=[name]`
`actionhero generateTask --name=[name]`        -> `actionhero generate task --name=[name]`
```
- Tasks now use middleware instead of plugins.
  - You will need to convert all uses of task plugins to task middleware.

## Upgrading from v13.x.x to v14.x.x
**Full Release Notes: [GitHub](https://github.com/evantahler/actionhero/releases/tag/v14.0.0)**

**Breaking Changes and How to Overcome Them:**

- Redis Client Configurations have changed drastically.  This allows for greater configuration, but at a complexity cost.
  - The easiest way to upgrade your `config/redis.js` is to take if from the [master branch](https://github.com/evantahler/actionhero/blob/master/config/redis.js) directly and re-apply your configuration.
  - Move `api.config.redis.channel` to `api.config.general.channel`
  - Move `api.config.redis. rpcTimeout` to `api.config.general.rpcTimeout`
  - Throughout the code, use `api.config.redis.client` rather than `api.redis.client`

## Upgrading from v12.x.x to v13.x.x
**Full Release Notes: [GitHub](https://github.com/evantahler/actionhero/releases/tag/v13.0.0)**

**Breaking Changes and How to Overcome Them:**

- Pluggins
  - `config/plugins.js` is removed.  Delete yours.  
  - Use the new binary command, `actionhero link --name=NameOfPlugin` to link your plugins in the new method.  
  - Linking plugins will likley create new config files you may need to customize.  
- Locales
  - This release introduced Locales. You will need the new locale config file.  The easiest way to upgrade your `config/i18n.js` is to take if from the [master branch](https://github.com/evantahler/actionhero/blob/master/config/i18n.js).
  - Ensure that `api.config.i18n.updateFiles` is `true` so that your locale files can be generated for the first time.
- Errors
  - `config/errors.js` has been completely redone to take advantage of `connection.localize`.  The easiest way to upgrade your `config/errors.js` is to take if from the [master branch](https://github.com/evantahler/actionhero/blob/master/config/errors.js).
- Grunt Removed
  - Grunt is removed from the project.  The old ActionHero grunt commands have been moved into the ActionHero binary.
- Redis configuration
  - `package` is a reserved keyword in JavaScript.  We now use the key `pkg` in the redis config.

## Upgrading from v11.x.x to v12.x.x
**Full Release Notes: [GitHub](https://github.com/evantahler/actionhero/releases/tag/v12.0.0)**

**Breaking Changes and How to Overcome Them:**

- Redis configuration
  - Switch from using the `redis` npm pacakge to `ioredis`.  Change this in your package.json.
 - `ioredis` handles passwords slightly differently.  Read the [ioredis](https://github.com/luin/ioredis) documentation to learn more.
- Stats Removed
  - The `api.stats` subsection has been removed from actionhero
  - If you need the stats subsection, you can get get it [via plugin](https://github.com/evantahler/ah-stats-plugin)  

## Upgrading from v10.x.x to v11.x.x
**Full Release Notes: [GitHub](https://github.com/evantahler/actionhero/releases/tag/v11.0.0)**

**Breaking Changes and How to Overcome Them:**

- Action Syntax changed
  - Actions now look like
```javascript
run: function(api, data, next){
  data.response.randomNumber = Math.random();
  next(error);
}
```
  - Where data contains:
```javascript
data = {
  connection: connection,
  action: 'randomNumber',
  toProcess: true,
  toRender: true,
  messageCount: 123,
  params: { action: 'randomNumber', apiVersion: 1 },
  actionStartTime: 123,
  response: {},
}
```
  - You will need to change all of your actions to use `data.connection` rather than `connection` directly.
  - You will need to change all of your actions to use `data.response` rather than `connection.response` directly.
- Middleware syntax has changed to match action's `data` pattern.  You will need to change your middleware accordingly.
- Removed `connection._originalConnection`.
- Websockets:
  - The params of websocket connections should NOT be sticky. All actions will start with `connection.params = {}`.  If you rely on the old behavior, you will need to change your client code.
- Action Processor:
  - Removed duplicate callback prevention in actionProcessor. This belongs on the user/implementer to handle.
