![](ops-tools.svg)

## Overview

Allow actionhero developers to create new files in `./bin` which can be run via the CLI. These commands will have access to a the ActionHero `api` and CLI arguments object within a `run` method.

You can create namespaces for commands by using folders. For example, a file in `./bin/redis/keys` would be run via `npx actionhero redis keys`

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

## Syntax

ActionHero CLI commands have:

*   name
*   description
*   example

Inputs for CLI commands have:

*   required (true/false)
*   default (string only)
*   note

These are sourced automatically by `actionhero help`, and the example above would return:

```bash
* redis keys
  description: I list all the keys in redis
  example: actionhero keys --prefix actionhero
  inputs:
    [prefix] (optional)
      note: the redis prefix for searching keys
      default: actionhero
```
