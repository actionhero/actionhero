module.exports = class CLI {
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
      description: this.name,
      example: '',
      inputs: {}
    }
  }

  validate (api) {
    if (!this.name) { throw new Error('name is required for this action') }
    if (!this.description) { throw new Error(`description is required for the action \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`action \`${this.name}\` has no run method`) }
  }
}
