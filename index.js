const path = require('path');

/**
 * The top-level for all actionhero methods which can be used within your project.
 *
 * @namespace api
 */

/**
 * The ActionHero module.
 *
 * @class ActionHero
 */

[
  { klass: 'Process', file: 'process.js' },
  { klass: 'Action', file: 'action.js' },
  { klass: 'Task', file: 'task.js' },
  { klass: 'Initializer', file: 'initializer.js' },
  { klass: 'Server', file: 'server.js' },
  { klass: 'CLI', file: 'cli.js' },
  { klass: 'ActionProcessor', file: 'actionProcessor.js' },
  { klass: 'Connection', file: 'connection.js' }
].forEach(({klass, file}) => {
  exports[klass] = require(path.join(__dirname, 'classes', file))
})
