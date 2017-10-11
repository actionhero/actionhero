## Overview

Allow actionhero developers to create new files in `./bin` which can be run via the CLI. These commands will have access to a the ActionHero `api` and CLI arguments object within a `run` method.

You can create namespaces for commands by using folders. For example, a file in `./bin/redis/keys` would be run via `./node_modules/.bin/actionhero redis keys --prefix actionhero`

```js
// A CLI Command

module.exports = {
  name: 'redis keys',
  description: 'I list all the keys in redis',
  example: 'actionhero keys --prefix actionhero',

  inputs: {
    prefix: {
      requried: true,
      default: 'actionhero',
      note: 'the redis prefix for searching keys'
    }
  },

  run: function (api, data, next) {
    api.redis.clients.client.keys(data.params.prefix, (error, keys) => {
      if (error) { throw error }

      api.log('Found ' + keys.length + 'keys:')
      keys.forEach((k) => { api.log(k) })

      return next(null, true)
    })
  }
}
```

## Syntax

ActionHero CLI commands have:

*   name
*   description
*   example

Inputs for CLI commands have:

*   required (true/false)
*   default (string only)
*   note

These are sourced by `actionhero help`, and the example above would return:

```bash
* redis keys
  description: I list all the keys in redis
  example: actionhero keys --prefix actionhero
  inputs:
    [prefix] (optional)
      note: the redis prefix for searching keys
      default: actionhero
```