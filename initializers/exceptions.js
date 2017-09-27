'use strict'

const os = require('os')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Handlers for when things go wrong.
 *
 * @namespace api.exceptions
 * @extends ActionHero.Initializer
 */
module.exports = class Exceptions extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'exceptions'
    this.loadPriority = 130
  }

  relevantDetails () {
    return ['action', 'remoteIP', 'type', 'params', 'room']
  }

  initialize () {
    api.exceptionHandlers = {}
    api.exceptionHandlers.reporters = []

    const consoleReporter = (error, type, name, objects, severity) => {
      let extraMessages = []

      if (type === 'loader') {
        extraMessages.push('! Failed to load ' + objects.fullFilePath)
      } else if (type === 'action') {
        extraMessages.push('! uncaught error from action: ' + name)
        extraMessages.push('! connection details:')
        let relevantDetails = this.relevantDetails()
        for (let i in relevantDetails) {
          let relevantDetail = relevantDetails[i]
          if (
            objects.connection[relevantDetail] !== null &&
            objects.connection[relevantDetail] !== undefined &&
            typeof objects.connection[relevantDetail] !== 'function'
          ) {
            extraMessages.push('!     ' + relevantDetail + ': ' + JSON.stringify(objects.connection[relevantDetail]))
          }
        }
      } else if (type === 'task') {
        extraMessages.push('! error from task: ' + name + ' on queue ' + objects.queue + ' (worker #' + objects.workerId + ')')
        try {
          extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args))
        } catch (e) {}
      } else {
        extraMessages.push('! Error: ' + error.message)
        extraMessages.push('!     Type: ' + type)
        extraMessages.push('!     Name: ' + name)
        extraMessages.push('!     Data: ' + JSON.stringify(objects))
      }

      for (let m in extraMessages) {
        api.log(extraMessages[m], severity)
      }
      let lines
      try {
        lines = error.stack.split(os.EOL)
      } catch (e) {
        lines = new Error(error).stack.split(os.EOL)
      }
      for (let l in lines) {
        let line = lines[l]
        api.log('! ' + line, severity)
      }
      api.log('*', severity)
    }

    api.exceptionHandlers.reporters.push(consoleReporter)

    api.exceptionHandlers.report = (error, type, name, objects, severity) => {
      if (!severity) { severity = 'error' }
      for (let i in api.exceptionHandlers.reporters) {
        api.exceptionHandlers.reporters[i](error, type, name, objects, severity)
      }
    }

    api.exceptionHandlers.loader = (fullFilePath, error) => {
      let name = 'loader:' + fullFilePath
      api.exceptionHandlers.report(error, 'loader', name, {fullFilePath: fullFilePath}, 'alert')
    }

    api.exceptionHandlers.action = (error, data, next) => {
      let simpleName
      try {
        simpleName = data.action
      } catch (e) {
        simpleName = error.message
      }
      let name = 'action:' + simpleName
      api.exceptionHandlers.report(error, 'action', name, {connection: data.connection}, 'error')
      data.connection.response = {} // no partial responses
      if (typeof next === 'function') { next() }
    }

    api.exceptionHandlers.task = (error, queue, task, workerId) => {
      let simpleName
      try {
        simpleName = task['class']
      } catch (e) {
        simpleName = error.message
      }
      let name = 'task:' + simpleName
      api.exceptionHandlers.report(error, 'task', name, {task: task, queue: queue, workerId: workerId}, api.config.tasks.workerLogging.failure)
    }
  }
}
