# Upgrading an Actionhero Project to Typescript (Actionhero v21)

## Packages & Package.json

```sh
npm install --save actionhero@next
npm install --save-dev @types/node prettier
npm uninstall standard
```

```json
  "scripts": {
    "postinstall": "yarn run build",
    "dev": "ts-node ./node_modules/.bin/actionhero",
    "start": "actionhero start",
    "build": "tsc --declaration",
    "pretest": "yarn run lint",
    "lint": "prettier --check src/*/**.ts __tests__/*/**.ts",
    "test": "jest"
  }
```

```json
"jest": {
  "testEnvironment": "node",
  "transform": {
    "^.+\\.ts?$": "ts-jest"
  }
};
```

Remove the block about `standard` from your `package.json`. We are switching to [prettier](_https://prettier.io) because it has better typescript support.

Remember - you will be using `npm run dev` now when developing locally.

## tsconfig.json

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "allowJs": true,
    "module": "commonjs",
    "target": "es2018"
  },
  "include": ["./src/**/*"]
}
```

## Project Structure

- Create the `src` and `dist` directories
- Move Actions, Tasks, Initializers, Servers, and Config into it
- Create a new `modules` directory

## Change all of your _.js files to _.ts

- All the files you just moved into `src`
  - Helpful rename command for _nix -> `for f in _.js; do mv -- "$f" "${f%.js}.ts"; done`
- Change the imports from Require `const {thing} = require('thing')` to Import `import { thing } from 'thing'`
- Change all the exports from Module `module.exports = ...` or `exports.thing = ...` to Generic `export const thing = ...`

## Config

- Change all of the exports, per above. When exporting the default config, use `DEFAULT` (all caps), ie: `export const DEFAULT = {api: { ... }}`
- Update your paths in `config/general` , ie:

```json
paths: {
  action: [path.join(__dirname, "..", "actions")],
  task: [path.join(__dirname, "..", "tasks")],
  server: [path.join(__dirname, "..", "servers")],
  cli: [path.join(__dirname, "..", "bin")],
  initializer: [path.join(__dirname, "..", "initializers")],
  public: [path.join(process.cwd(), "public")],
  pid: [path.join(process.cwd(), "pids")],
  log: [path.join(process.cwd(), "log")],
  plugin: [path.join(process.cwd(), "node_modules")],
  locale: [path.join(process.cwd(), "locales")],
  test: [path.join(process.cwd(), "__tests__")],
  src: path.join(process.cwd(), "src"),
  dist: path.join(process.cwd(), "dist")
}
```

Don’t forget any paths you might have in other environments (like `test`)!

## Middleware and Sessions

Now with Typescript, you’ll get an error if you try to set arbitrary properties on the data object either within an action or middleware. We need a place to pass data from the middleware to the action.

```ts
const authenticatedTeamMemberMiddleware = {
  name: "authenticated-team-member",
  global: false,
  priority: 1000,
  preProcessor: async data => {
    const { Team, TeamMember } = api.models;
    const sessionData = await api.session.load(data.connection);
    if (!sessionData) {
      throw new Error("Please log in to continue");
    } else if (
      !data.params.csrfToken ||
      data.params.csrfToken !== sessionData.csrfToken
    ) {
      throw new Error("CSRF error");
    } else {
      const teamMember = await TeamMember.findOne({
        where: { guid: sessionData.guid },
        include: Team
      });
      data.session.data = sessionData; /// <--- HERE/
      data.session.teamMember = teamMember; /// <--- HERE/
    }
  }
};
```

## Modules and Initializers

A number of things have been moved off of the API object to simlify thier use by creating import/export modules you can require directly. In this way, you can get type hinting for various parts of actionhro! This is a logical seperation between `initailziers` - code that excecutes when your server boots up and loads or connects vs `modules` which provide an API for you to use in your code.

For example, the `task` system has been split into 2 parts - both a `module` and `initializer`. The initializer continues to load your tasks into `api.tasks.tasks`, but doesn’t expose any methods for you to use. Now, when you wan to call `task.enqueue()` you load it from the module via `import {task} from 'actionhero'`

The `initialize`, `start`, and `stop` methods of your initializers will now be passed `config`. This is helpful in the off chance you are modifying `config` and cannot rely on the static export of that information (this is rare).

### Removed from the API object and are now directly exported by Actionhero as modules:

ie: `import { log, config } from 'actionhero'`

- log (the method to write to the logs)
- config (the config object hash)
- action (addMiddleware)
- task (addMiddleware)
- cache
- task
- i18n
- specHelper
- id (the server’s id)
- env (development, staging, production)
- localize (method that accepts a string and a connection)
- watchFileAndAct / unWatchAllFiles (methods)

### The API object

what remains on the API object are truly things about your API - actions, tasks, servers, initializers. And now these elements are very typesafe. **_You can no longer add and remove things randomly to the API object_**. This means that in your project, you should create imports/and exorts directly and share them with your actions and tasks.

## Config

- `config.general.id`: can no longer be set
- `config.i18n.determineConnectionLocale`: this method should be set on the `i18n` object exported by actionhero.

## Chat

- `chatRoom.sanitizeMemberDetails()` is no longer overridable/customizable.
