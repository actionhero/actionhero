# Contributing

First, **THANK YOU**.  

ActionHero would not be the success it is today without the contributions of [many people](https://github.com/actionhero/actionhero/graphs/contributors).  Thank you for taking the time to help out this open source project, and create something we can all use!

## Pull Requests

All changes to ActionHero should be sent in as [Pull Requests](https://help.github.com/articles/about-pull-requests) to our [Github Project](https://github.com/actionhero/actionhero).  Changes by any other method will be instantly rejected.  GitHub allows us to coordinate and communicate in a single place.

## Testing

Be sure that your changes pass the test suite!  Run `npm test` to run the full test suite.
You will need redis and node.js installed.  No other external dependancies are needed.

**Every contribution to the codebase should have an associated test**

If you need help writing tests, please ask for help in the [slack team](http://slack.actionherojs.com)

## Linting

We use [standard.js](https://standardjs.com) to manage our lint rules.  We run `standard` as part of our test suite, and your contributions must pass.  Standard is *very* opinionated and inflexible such that we cannot inject our own opinions.  There are no eslint/jshint files to manage in this project.  

## Documentation

If your contribution adds a new feature of modifies an existing behavior, to document your changes using [JSdoc](http://usejsdoc.org/).  We use JSdoc to automatically document ActionHero, and build [docs.actionherojs.com](docs.actionherojs.com) automatically.  There are many plugins to help you with this, like this one for [Atom](https://atom.io/packages/jsdoc), or this one for [VS Code](https://github.com/joelday/vscode-docthis)
