module.exports = class Task {
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
      frequency: 0,
      queue: 'default',
      middleware: []
    }
  }

  validate (api) {
    if (!this.name) { throw new Error('name is required for this task') }
    if (!this.description) { throw new Error(`description is required for the task \`${this.name}\``) }
    if (!this.queue) { throw new Error(`queue is required for the task \`${this.name}\``) }
    if (this.frequency === null || this.frequency === undefined) { throw new Error(`frequency is required for the task \`${this.name}\``) }
    if (!this.run || typeof this.run !== 'function') { throw new Error(`task \`${this.name}\` has no run method`) }
  }
}
