// const { Process, Server, api }  = require('actionhero')
const { Process, api } = require('./index.js')

const actionhero = new Process()

const sleep = async (time = 100) => {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

const checkRunning = async () => {
  console.log('.')
  if (api.running !== true) {
    await sleep()
    return checkRunning()
  }
}

(async () => {
  module.exports.run = async (event, context, callback) => {
    await checkRunning()
    await api.servers.servers.lambda.runFunction(event, context, callback)
    await actionhero.stop()
  }

  actionhero.start()
  // let server = new LambdaServer()
  // server.config = { enabled: true }
  // await server.start(api)
  // api.servers.servers.lambda = server
})()
