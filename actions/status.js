'use strict'

const ActionHero = require('./../index.js')
const path = require('path')
const packageJSON = require(path.normalize(path.join(__dirname, '..', 'package.json')))

// These values are probably good starting points, but you should expect to tweak them for your application
const maxEventLoopDelay = process.env.eventLoopDelay || 10
const maxMemoryAlloted = process.env.maxMemoryAlloted || 200
const maxResqueQueueLength = process.env.maxResqueQueueLength || 1000

module.exports = class RandomNumber extends ActionHero.Action {
  constructor () {
    super()
    this.name = 'status'
    this.description = 'I will return some basic information about the API'
    this.outputExample = {
      'id': '192.168.2.11',
      'actionheroVersion': '9.4.1',
      'uptime': 10469
    }
  }

  async checkRam (data) {
    const consumedMemoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100
    data.response.consumedMemoryMB = consumedMemoryMB
    if (consumedMemoryMB > maxMemoryAlloted) {
      data.response.nodeStatus = data.connection.localize('Unhealthy')
      data.response.problems.push(data.connection.localize(['Using more than {{maxMemoryAlloted}} MB of RAM/HEAP', {maxMemoryAlloted: maxMemoryAlloted}]))
    }
  }

  async checkEventLoop (data) {
    const api = ActionHero.api
    let eventLoopDelay = await api.utils.eventLoopDelay(10000)
    data.response.eventLoopDelay = eventLoopDelay
    if (eventLoopDelay > maxEventLoopDelay) {
      data.response.nodeStatus = data.connection.localize('Node Unhealthy')
      data.response.problems.push(data.connection.localize(['EventLoop Blocked for more than {{maxEventLoopDelay}} ms', {maxEventLoopDelay: maxEventLoopDelay}]))
    }
  }

  async checkResqueQueues (data) {
    const api = ActionHero.api
    let details = await api.tasks.details()
    let length = 0
    Object.keys(details.queues).forEach((q) => {
      length += details.queues[q].length
    })

    data.response.resqueTotalQueueLength = length

    if (length > maxResqueQueueLength) {
      data.response.nodeStatus = data.connection.localize('Node Unhealthy')
      data.response.problems.push(data.connection.localize(['Resque Queues over {{maxResqueQueueLength}} jobs', {maxResqueQueueLength: maxResqueQueueLength}]))
    }
  }

  async run (data) {
    const api = ActionHero.api

    data.response.nodeStatus = data.connection.localize('Node Healthy')
    data.response.problems = []

    data.response.id = api.id
    data.response.actionheroVersion = api.actionheroVersion
    data.response.uptime = new Date().getTime() - api.bootTime
    data.response.name = packageJSON.name
    data.response.description = packageJSON.description
    data.response.version = packageJSON.version

    await this.checkRam(data)
    await this.checkEventLoop(data)
    await this.checkResqueQueues(data)
  }
}
