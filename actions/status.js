'use strict'

const path = require('path')
const packageJSON = require(path.normalize(path.join(__dirname, '..', 'package.json')))

// These values are probably good starting points, but you should expect to tweak them for your application
const maxEventLoopDelay = process.env.eventLoopDelay || 10
const maxMemoryAlloted = process.env.maxMemoryAlloted || 200
const maxResqueQueueLength = process.env.maxResqueQueueLength || 1000

exports.status = {
  name: 'status',
  description: 'I will return some basic information about the API',

  outputExample: {
    'id': '192.168.2.11',
    'actionheroVersion': '9.4.1',
    'uptime': 10469
  },

  run: function (api, data, next) {
    /* --- Define Helpers --- */

    const checkRam = function (callback) {
      const consumedMemoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100
      data.response.consumedMemoryMB = consumedMemoryMB
      if (consumedMemoryMB > maxMemoryAlloted) {
        data.response.nodeStatus = data.connection.localize('Unhealthy')
        data.response.problems.push(data.connection.localize(['Using more than {{maxMemoryAlloted}} MB of RAM/HEAP', {maxMemoryAlloted: maxMemoryAlloted}]))
      }

      callback()
    }

    const checkEventLoop = function (callback) {
      api.utils.eventLoopDelay(10000, function (error, eventLoopDelay) {
        if (error) { return callback(error) }
        data.response.eventLoopDelay = eventLoopDelay
        if (eventLoopDelay > maxEventLoopDelay) {
          data.response.nodeStatus = data.connection.localize('Node Unhealthy')
          data.response.problems.push(data.connection.localize(['EventLoop Blocked for more than {{maxEventLoopDelay}} ms', {maxEventLoopDelay: maxEventLoopDelay}]))
        }

        callback()
      })
    }

    const checkResqueQueues = function (callback) {
      api.tasks.details(function (error, details) {
        if (error) { return callback(error) }
        let length = 0
        Object.keys(details.queues).forEach(function (q) {
          length += details.queues[q].length
        })

        data.response.resqueTotalQueueLength = length

        if (length > maxResqueQueueLength) {
          data.response.nodeStatus = data.connection.localize('Node Unhealthy')
          data.response.problems.push(data.connection.localize(['Resque Queues over {{maxResqueQueueLength}} jobs', {maxResqueQueueLength: maxResqueQueueLength}]))
        }

        callback()
      })
    }

    /* --- Run --- */

    data.response.nodeStatus = data.connection.localize('Node Healthy')
    data.response.problems = []

    data.response.id = api.id
    data.response.actionheroVersion = api.actionheroVersion
    data.response.uptime = new Date().getTime() - api.bootTime
    data.response.name = packageJSON.name
    data.response.description = packageJSON.description
    data.response.version = packageJSON.version

    checkRam(function (error) {
      if (error) { return next(error) }
      checkEventLoop(function (error) {
        if (error) { return next(error) }
        checkResqueQueues(function (error) {
          next(error)
        })
      })
    })
  }
}
