'use strict'

// ////////////////////////////////////////////////////////////////////////////////////////////////////
//
// TO START IN CONSOLE: "./bin/actionhero start cluster"
//
// ** Production-ready actionhero cluster **
// - be sure to enable redis so that workers can share state
// - workers which die will be restarted
// - maser/manager specific logging
// - pidfile for master
// - USR2 restarts (graceful reload of workers while handling requests)
//   -- Note, socket/websocket clients will be disconnected, but there will always be a worker to handle them
//   -- HTTP/HTTPS/TCP clients will be allowed to finish the action they are working on before the server goes down
// - TTOU and TTIN signals to subtract/add workers
// - TCP, HTTP(S), and Web-socket clients will all be shared across the cluster
// - Can be run as a daemon or in-console
//   -- Simple Daemon: "actionhero start cluster --daemon"
//
// * Setting process titles does not work on windows or OSX
//
// This tool was heavily inspired by Ruby Unicorns [[ http://unicorn.bogomips.org/ ]]
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////

const path = require('path')
const os = require('os')
const ActionHeroCluster = require(path.join(__dirname, 'lib', 'actionheroCluster.js'))
const ActionHero = require('./../../../index.js')
const api = ActionHero.api

module.exports = class StartCluster extends ActionHero.CLI {
  constructor () {
    super()
    this.name = 'start cluster'
    this.description = 'start an actionhero cluster'
    this.example = 'actionhero start cluster --workers=[numWorkers] --workerTitlePrefix=[title] --daemon'
    this.inputs = {
      workers: {
        required: true,
        default: os.cpus().length,
        note: 'number of workers (defaults to # CPUs)'
      },
      title: {
        required: false,
        note: 'worker title prefix (default \'actionhero-worker-\') set `--workerTitlePrefix=hostname`, your app.id would be like `your_host_name-#`'
      },
      workerTitlePrefix: {
        required: true,
        default: 'actionhero-worker-'
      },
      daemon: {
        required: false,
        note: 'to fork and run as a new background process defaults to false'
      },
      silent: {required: false}
    }
  }

  async run ({params}) {
    let options = {
      execPath: path.normalize(path.join(__dirname, '/../../actionhero')),
      args: 'start',
      silent: (params.silent === 'true' || params.silent === true),
      expectedWorkers: params.workers,
      id: api.id,
      buildEnv: (workerId) => {
        let env = {}

        for (let k in process.env) {
          env[k] = process.env[k]
        }

        let title = params.workerTitlePrefix

        if (!title || title === '') {
          title = 'actionhero-worker-'
        } else if (title === 'hostname') {
          title = os.hostname() + '-'
        }

        title += workerId
        env.title = title
        env.ACTIONHERO_TITLE = title

        return env
      }
    }

    const cluster = new ActionHeroCluster(options)
    await cluster.start()
    return false
  }
}
