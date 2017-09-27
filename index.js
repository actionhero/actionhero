const path = require('path');

/**
 * The top-level for all actionhero methods which can be used within your project.
 *
 * @namespace api
 * @property {string} env - The environment (usually sourced from `process.env.NODE_ENV`) the server is running in.
 * @property {Boolean} running - Is the process running?
 * @property {Boolean} initialized - Have we loded the initialize step of the initializers?
 * @property {Boolean} shuttingDown - Is the process in the middle of stopping?
 * @property {string} projectRoot - The path to the root of your project?
 * @property {Date} bootTime - The time this server was started?
 * @property {Number} id - The ID of this server.  Can be set by `argv.title`, `process.env.ACTIONHERO_TITLE`, `api.config.general.id`.  The default is using this server's external IP address and PID.
 * @property {Array} watchedFiles - Array of file which this server is monitoring and will act on if changed (Devloper Mode)
 */

/**
 * Monitor a file and call handler when it changes on disk.  Only availalbe in Development Mode.
 *
 * @function api.watchFileAndAct
 * @param {string} file - The name of the file to watch.
 * @param {Function} callback - Method to call when the file changes.  Callback will be passed the name of the changed file.
 * @see api.unWatchAllFiles
 */

/**
 * Stop watching all files previously watched via api.watchFileAndAct.  Only availalbe in Development Mode.
 *
 * @function api.unWatchAllFiles
 * @see api.watchFileAndAct
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
