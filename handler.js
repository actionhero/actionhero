// const { Process, Server, api }  = require('actionhero')
const { Process, api } = require('./index.js')

const actionhero = new Process()

const sleep = async (time = 100) => {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

const awaitRunning = async () => {
  if (api.running !== true) {
    await sleep()
    return awaitRunning()
  }
}

(async () => {
  module.exports.run = async (event, context, callback) => {
    await awaitRunning()
    await api.servers.servers.lambda.runFunction(event, context, callback)
    await actionhero.stop()
  }

  actionhero.start()
})()
