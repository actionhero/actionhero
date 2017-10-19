![](flying-man.svg)

## Overview

ActionHero provides test helpers so that you may try your actions and tasks within a headless environment. We do this by including a `specHelper` initializer which creates a server, `testServer` when running within the test environment. Via the `testServer`, you can easily call actions or tasks without making a real request.

We have chosen [mocha](http://mochajs.org/) as our test framework and [chai](http://chaijs.com/) as our assertion tool which are included as dependencies within all new projects generated with `actionhero generate`. We also use `cross-env` to set NODE_ENV in a way that works for all operating systems, including Windows. You do not need to use these testing tools, but an example will be provided which makes use of them.

You also don't need to use these test helpers, and you may want to make a real http or websocket request to test something specific. If this is the case, you can [check out how ActionHero tests its own servers](https://github.com/actionhero/actionhero/tree/master/test/servers) for examples.

## Getting Started

```js
// package.json from a new actionhero project with \`mocha\` and \`chai\` included
{
  "author"      : "YOU <YOU@example.com>",
  "name"        : "my_actionhero_project",
  "description" : "my actionhero project",
  "version"     : "0.1.0",
  "engines"     : {
    "node": ">=8.0.0"
  },
  "dependencies" : {
    "actionhero" : "^14.0.0",
    "ws"         : "latest"
  },
  "devDependencies" : {
    "cross-env": "latest",
    "mocha"  : "latest",
    "chai" : "latest"
  },
  "scripts" : {
    "help"         : "actionhero help",
    "start"        : "actionhero start",
    "actionhero"   : "actionhero",
    "start cluster": "actionhero start cluster",
    "test"         : "cross-env NODE_ENV=test mocha"
  }
}
```

To run a mocha test suite, you invoke the mocha binary, `./node_modules/.bin/mocha` or `npx mocha`. This will tell mocha to look in your `./test` folder and run any tests that it can find. There are ways to change the test folder location, only run specific tests, change the reporting format and more which you can learn about on [Mocha's website](http://mochajs.org/). We assume that you have `mocha` (and `chai`) installed to your project by listing it in your `package.json`. If you used `actionHero generate` to create your project, this should already be configured for you.

The majority of the time, you'll be testing actions and other methods you have written, so you'll need to "run" an actionhero server as part of your test suite. Many times you'll want to have ActionHero behave in a slightly unique way while testing (perhaps connect to a special database, don't log, etc). To do this, you can change the behavior of the config files for the `test` environment. Here is how we tell ActionHero [not to write any logs when testing](https://github.com/actionhero/actionhero/blob/master/config/logger.js#L48-L54). Note the test-specific configuration overrides the defaults. To ensure that ActionHero boots with the `test` environment loaded, the test command you run should explicitly do this, AKA: `NODE_ENV=test npx mocha`. You can set this in as the [`test` script in your `package.json`](https://github.com/actionhero/actionhero/blob/master/package.json#L63) so you can simplify the running of tests with just `npm test`.

ActionHero comes with a `specHelper` to make it easier to test tasks and actions. This specHelper is a special [server](/docs/core/#servers) which can check things without needing to make an HTTP, websocket, etc request. If you need to check the true behavior of a server (perhaps how the router works for an HTTP request), you should make a real HTTP request in your test suite, using something like the [request](https://github.com/request/request) library ([example](https://github.com/actionhero/actionhero/blob/master/test/servers/web.js#L178-L184)).

## Example Test

Say you had an action that was supposed to respond with a `randomNumber`, and you wanted to write a test for it.

```js
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

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

More details on the specHelper methods [can be found here](api.specHelper.html)

If you want to see fuller example of how to create an integration test within ActionHero, please [check out the tutorial](https://github.com/actionhero/actionhero-tutorial#testing)

## Notes

Be sure to run your tests in the `test` environment, setting the shell's env with `NODE_ENV=test`. You can alternatively set this explicitly in your tests with `process.env.NODE_ENV = 'test'`

If you do not want the `specHelper` actions to include metadata (`data.response.serverInformation`, `data.response.requesterInformation`, and `data.response.messageCount`) from the server, you can configure `api.specHelper.returnMetadata = false` in your tests.
