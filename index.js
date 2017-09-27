const path = require('path');

/**
 * The top-level for all actionhero methods which can be used within your project.
 *
 * @namespace api
 * @property {Boolean} running - Is the process running?
 * @property {Boolean} initialized - Have we loded the initialize step of the initializers?
 * @property {Boolean} shuttingDown - Is the process in the middle of stopping?
 * @property {string} projectRoot - The path to the root of your project?
 * @property {Date} bootTime - The time this server was started?
 * @property {Number} id - The ID of this server.  Can be set by `argv.title`, `process.env.ACTIONHERO_TITLE`, `api.config.general.id`.  The default is using this server's external IP address and PID.
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

exports.api = {}
