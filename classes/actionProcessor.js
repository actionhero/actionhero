let api

module.exports = class ActionProcessor {
  constructor (connection) {
    // Only in files required by `index.js` do we need to delay the loading of the API object
    // This is due to cyclical require issues
    api = require('./../index.js').api

    if (!connection) {
      throw new Error('data.connection is required')
    }

    this.connection = connection
    this.action = null
    this.toProcess = true
    this.toRender = true
    this.messageCount = connection.messageCount
    this.params = Object.assign({}, connection.params)
    this.missingParams = []
    this.validatorErrors = []
    this.actionStartTime = null
    this.actionTemplate = null
    this.working = false
    this.response = {}
    this.duration = null
    this.actionStatus = null
  }

  incrementTotalActions (count) {
    if (!count) { count = 1 }
    this.connection.totalActions = this.connection.totalActions + count
  }

  incrementPendingActions (count) {
    if (!count) { count = 1 }
    this.connection.pendingActions = this.connection.pendingActions + count
    if (this.connection.pendingActions < 0) { this.connection.pendingActions = 0 }
  }

  getPendingActionCount () {
    return this.connection.pendingActions
  }

  async completeAction (status) {
    let error = null
    this.actionStatus = String(status)

    if (status instanceof Error) {
      error = status
    } else if (status === 'server_shutting_down') {
      error = await api.config.errors.serverShuttingDown(this)
    } else if (status === 'too_many_requests') {
      error = await api.config.errors.tooManyPendingActions(this)
    } else if (status === 'unknown_action') {
      error = await api.config.errors.unknownAction(this)
    } else if (status === 'unsupported_server_type') {
      error = await api.config.errors.unsupportedServerType(this)
    } else if (status === 'missing_params') {
      error = await api.config.errors.missingParams(this, this.missingParams)
    } else if (status === 'validator_errors') {
      error = await api.config.errors.invalidParams(this, this.validatorErrors)
    } else if (status) {
      error = status
    }

    if (error && typeof error === 'string') {
      error = new Error(error)
    }

    if (error && !this.response.error) {
      if (typeof this.response === 'string' || Array.isArray(this.response)) {
        this.response = error.toString()
      } else {
        this.response.error = error
      }
    }

    this.incrementPendingActions(-1)
    this.duration = new Date().getTime() - this.actionStartTime
    this.working = false
    this.logAction(error)
    return this
  }

  logAction (error) {
    let logLevel = 'info'
    if (this.actionTemplate && this.actionTemplate.logLevel) {
      logLevel = this.actionTemplate.logLevel
    }

    let filteredParams = api.utils.filterObjectForLogging(this.params)

    const logLine = {
      to: this.connection.remoteIP,
      action: this.action,
      params: JSON.stringify(filteredParams),
      duration: this.duration
    }

    if (error) {
      if (error instanceof Error) {
        logLine.error = String(error)
      } else {
        try {
          logLine.error = JSON.stringify(error)
        } catch (e) {
          logLine.error = String(error)
        }
      }
    }

    api.log(`[ action @ ${this.connection.type} ]`, logLevel, logLine)
  }

  async preProcessAction () {
    let processorNames = api.actions.globalMiddleware.slice(0)

    if (this.actionTemplate.middleware) {
      this.actionTemplate.middleware.forEach(function (m) { processorNames.push(m) })
    }

    for (let i in processorNames) {
      let name = processorNames[i]
      if (typeof api.actions.middleware[name].preProcessor === 'function') {
        await api.actions.middleware[name].preProcessor(this)
      }
    }
  }

  async postProcessAction () {
    let processorNames = api.actions.globalMiddleware.slice(0)

    if (this.actionTemplate.middleware) {
      this.actionTemplate.middleware.forEach((m) => { processorNames.push(m) })
    }

    for (let i in processorNames) {
      let name = processorNames[i]
      if (typeof api.actions.middleware[name].postProcessor === 'function') {
        await api.actions.middleware[name].postProcessor(this)
      }
    }
  }

  reduceParams (schemaKey) {
    let inputs = this.actionTemplate.inputs || {}
    let params = this.params
    if (schemaKey) {
      inputs = this.actionTemplate.inputs[schemaKey].schema
      params = this.params[schemaKey]
    }

    let inputNames = Object.keys(inputs) || []
    if (api.config.general.disableParamScrubbing !== true) {
      for (let p in params) {
        if (api.params.globalSafeParams.indexOf(p) < 0 && inputNames.indexOf(p) < 0) {
          delete params[p]
        }
      }
    }
  }

  prepareStringMethod (method) {
    const cmdParts = method.split('.')
    const cmd = cmdParts.shift()
    if (cmd !== 'api') { throw new Error('cannot operate on a method outside of the api object') }
    return api.utils.dotProp.get(api, cmdParts.join('.'))
  }

  async validateParam (props, params, key, schemaKey) {
    // default
    if (params[key] === undefined && props['default'] !== undefined) {
      if (typeof props['default'] === 'function') {
        params[key] = await props['default'].call(api, params[key], this)
      } else {
        params[key] = props['default']
      }
    }

    // formatter
    if (params[key] !== undefined && props.formatter !== undefined) {
      if (!Array.isArray(props.formatter)) { props.formatter = [props.formatter] }

      for (let i in props.formatter) {
        let formatter = props.formatter[i]
        if (typeof formatter === 'function') {
          params[key] = await formatter.call(api, params[key], this)
        } else {
          const method = this.prepareStringMethod(formatter)
          params[key] = await method.call(api, params[key], this)
        }
      }
    }

    // validator
    if (params[key] !== undefined && props.validator !== undefined) {
      if (!Array.isArray(props.validator)) { props.validator = [props.validator] }

      for (let j in props.validator) {
        let validator = props.validator[j]
        let validatorResponse
        try {
          if (typeof validator === 'function') {
            validatorResponse = await validator.call(api, params[key], this)
          } else {
            const method = this.prepareStringMethod(validator)
            validatorResponse = await method.call(api, params[key], this)
          }
          if (validatorResponse !== true) {
            if (validatorResponse === false) {
              this.validatorErrors.push(new Error(`Input for parameter "${key}" failed validation!`))
            } else {
              this.validatorErrors.push(validatorResponse)
            }
          }
        } catch (error) {
          this.validatorErrors.push(error)
        }
      }
    }

    // required
    if (props.required === true) {
      if (api.config.general.missingParamChecks.indexOf(params[key]) >= 0) {
        let missingKey = key
        if (schemaKey) {
          missingKey = `${schemaKey}.${missingKey}`
        }
        this.missingParams.push(missingKey)
      }
    }
  }

  async validateParams (schemaKey) {
    let inputs = this.actionTemplate.inputs || {}
    let params = this.params
    if (schemaKey) {
      inputs = this.actionTemplate.inputs[schemaKey].schema
      params = this.params[schemaKey]
    }

    for (let key in inputs) {
      const props = inputs[key]
      await this.validateParam(props, params, key, schemaKey)

      if (props.schema && params[key]) {
        this.reduceParams(key)
        await this.validateParams(key)
      }
    }
  }

  lockParams () {
    this.params = Object.freeze(this.params)
  }

  async processAction () {
    this.actionStartTime = new Date().getTime()
    this.working = true
    this.incrementTotalActions()
    this.incrementPendingActions()
    this.action = this.params.action

    if (api.actions.versions[this.action]) {
      if (!this.params.apiVersion) {
        this.params.apiVersion = api.actions.versions[this.action][api.actions.versions[this.action].length - 1]
      }
      this.actionTemplate = api.actions.actions[this.action][this.params.apiVersion]
    }

    if (api.running !== true) {
      return this.completeAction('server_shutting_down')
    }

    if (this.getPendingActionCount(this.connection) > api.config.general.simultaneousActions) {
      return this.completeAction('too_many_requests')
    }

    if (!this.action || !this.actionTemplate) {
      return this.completeAction('unknown_action')
    }

    if (this.actionTemplate.blockedConnectionTypes && this.actionTemplate.blockedConnectionTypes.indexOf(this.connection.type) >= 0) {
      return this.completeAction('unsupported_server_type')
    }

    return this.runAction()
  }

  async runAction () {
    try {
      await this.preProcessAction()
      await this.reduceParams()
      await this.validateParams()
      this.lockParams()
    } catch (error) {
      return this.completeAction(error)
    }

    if (this.missingParams.length > 0) {
      return this.completeAction('missing_params')
    }

    if (this.validatorErrors.length > 0) {
      return this.completeAction('validator_errors')
    }

    if (this.toProcess === true) {
      try {
        await this.actionTemplate.run(this)
        await this.postProcessAction()
        return this.completeAction()
      } catch (error) {
        return this.completeAction(error)
      }
    } else {
      return this.completeAction()
    }
  }
}
