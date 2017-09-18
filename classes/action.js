module.exports = class Action {
  constructor () {
    let coreProperties = this.coreProperties()
    for (let key in coreProperties) {
      if (!this[key]) { this[key] = coreProperties[key] }
      if (typeof this[key] === 'function') { this[key] = this[key]() }
    }
  }

  coreProperties () {
    return {
      name: null,
      version: 1,
      description: this.name,
      outputExample: {},
      inputs: {},
      middleware: [],
      blockedConnectionTypes: [],
      logLevel: 'info',
      matchExtensionMimeType: true,
      toDocument: true
    }
  }

  validate (api) {
    if (!this.name) { throw new Error('name is required for this action') }
    if (!this.description) { throw new Error(`description is required for the action \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`action \`${this.name}\` has no run method`) }
    if (api.connections && api.connections.allowedVerbs.indexOf(this.name) >= 0) {
      throw new Error(`action \`${this.name}\` is a reserved verb for connections. choose a new name`)
    }
  }
}
