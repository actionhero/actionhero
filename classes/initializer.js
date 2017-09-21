module.exports = class Initializer {
  constructor (defaults) {
    this.name = null
    this.loadPriority = 1000
    this.startPriority = 1000
    this.stopPriority = 1000
  }

  validate (api) {
    if (!this.name) { throw new Error('name is required for this initializer') }

    [
      'loadPriority',
      'startPriority',
      'stopPriority'
    ].forEach((priority) => {
      if (!this[priority] || typeof this[priority] !== 'number' || this[priority] < 0) {
        throw new Error(`${priority} is a required property for the initializer \`${this.name}\``)
      }
    })
  }
}
