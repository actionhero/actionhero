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

Remove the block about `standard` from your `package.json`. We are switching to [prettier](https://prettier.io/) because it has better typescript support.

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

## Change all of your _.js files to _.ts

- All the files you just moved into `src`
  * Helpful rename command for *nix -> `for f in *.js; do mv -- "$f" "${f%.js}.ts"; done`
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
      data.session.data = sessionData; // <--- HERE
      data.session.teamMember = teamMember; // <--- HERE
    }
  }
};
```
