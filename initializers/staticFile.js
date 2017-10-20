'use strict'

const fs = require('fs')
const path = require('path')
const Mime = require('mime')

/**
 * Countains helpers for returning flies to connections.
 *
 * @namespace api.staticFile
 * @property {Array} searchLoactions - This paths which can be searched for this file.  Comprised of paths from api.config.general.paths and plugins.
 */

module.exports = {
  loadPriority: 510,
  initialize: function (api, next) {
    api.staticFile = {

      searchLoactions: [],

      searchPath: function (connection, counter) {
        if (!counter) { counter = 0 }
        if (api.staticFile.searchLoactions.length === 0 || counter >= api.staticFile.searchLoactions.length) {
          return null
        } else {
          return api.staticFile.searchLoactions[counter]
        }
      },

      // connection.params.file should be set
      // callback is of the form: callback(connection, error, fileStream, mime, length)

      /**
       * For a connection with `connecton.params.file` set, return a file if we can find it, or a not-found message.
       * `searchLoactions` will be cheked in the following order: first paths in this project, then plugins.
       * This can be used in Actions to return files to clients.  If done, set `data.toRender = false` within the action.
       *
       * @param  {Object}  connection An ActionHero.Connection
       * @param  {Nmbber}  counter    (do not set) An internal couner to track which path we should check on (recursive)
       * @param  {fileCallback} callback The callback that handles the response.
       */
      get: function (connection, callback, counter) {
        if (!counter) { counter = 0 }
        if (!connection.params.file || !api.staticFile.searchPath(connection, counter)) {
          this.sendFileNotFound(connection, api.config.errors.fileNotProvided(connection), callback)
        } else {
          let file
          if (!path.isAbsolute(connection.params.file)) {
            file = path.normalize(api.staticFile.searchPath(connection, counter) + '/' + connection.params.file)
          } else {
            file = connection.params.file
          }

          if (file.indexOf(path.normalize(api.staticFile.searchPath(connection, counter))) !== 0) {
            api.staticFile.get(connection, callback, counter + 1)
          } else {
            this.checkExistence(file, (error, exists, truePath) => {
              if (error) { throw error }
              if (exists) {
                this.sendFile(truePath, connection, callback)
              } else {
                api.staticFile.get(connection, callback, counter + 1)
              }
            })
          }
        }
      },

      sendFile: function (file, connection, callback) {
        let lastModified
        fs.stat(file, (error, stats) => {
          if (error) {
            this.sendFileNotFound(connection, api.config.errors.fileReadError(connection, String(error)), callback)
          } else {
            let mime = Mime.lookup(file)
            let length = stats.size
            let fileStream = fs.createReadStream(file)
            let start = new Date().getTime()
            lastModified = stats.mtime
            fileStream.on('end', () => {
              let duration = new Date().getTime() - start
              this.logRequest(file, connection, length, duration, true)
            })
            fileStream.on('error', (error) => {
              api.log(error)
            })
            fileStream.on('open', () => {
              callback(connection, null, fileStream, mime, length, lastModified)
            })
          }
        })
      },

      sendFileNotFound: function (connection, errorMessage, callback) {
        connection.error = new Error(errorMessage)
        this.logRequest('{not found}', connection, null, null, false)
        callback(connection, api.config.errors.fileNotFound(connection), null, 'text/html', api.config.errors.fileNotFound(connection).length)
      },

      checkExistence: function (file, callback) {
        fs.stat(file, (error, stats) => {
          if (error) {
            callback(null, false, file)
          } else {
            if (stats.isDirectory()) {
              let indexPath = file + '/' + api.config.general.directoryFileType
              api.staticFile.checkExistence(indexPath, callback)
            } else if (stats.isSymbolicLink()) {
              fs.readLink(file, function (error, truePath) {
                if (error) {
                  callback(null, false, file)
                } else {
                  truePath = path.normalize(truePath)
                  api.staticFile.checkExistence(truePath, callback)
                }
              })
            } else if (stats.isFile()) {
              callback(null, true, file)
            } else {
              callback(null, false, file)
            }
          }
        })
      },

      logRequest: function (file, connection, length, duration, success) {
        api.log(`[ file @ ${connection.type} ]`, api.config.general.fileRequestLogLevel, {
          to: connection.remoteIP,
          file: file,
          requestedFile: connection.params.file,
          size: length,
          duration: duration,
          success: success
        })
      }

    }

    // load in the explicit public paths first
    if (api.config.general.paths !== undefined) {
      api.config.general.paths['public'].forEach(function (p) {
        api.staticFile.searchLoactions.push(path.normalize(p))
      })
    }

    // source the .linked paths from plugins
    if (api.config.general.paths !== undefined) {
      api.config.general.paths['public'].forEach((p) => {
        let pluginPath = p + path.sep + 'plugins'
        if (fs.existsSync(pluginPath)) {
          fs.readdirSync(pluginPath).forEach(function (file) {
            let parts = file.split('.')
            let name = parts[0]
            if (parts[(parts.length - 1)] === 'link' && fs.readFileSync(pluginPath + path.sep + file).toString() === 'public') {
              api.config.general.paths.plugin.forEach(function (potentialPluginPath) {
                potentialPluginPath = path.normalize(potentialPluginPath + path.sep + name + path.sep + 'public')
                if (fs.existsSync(potentialPluginPath) && api.staticFile.searchLoactions.indexOf(potentialPluginPath) < 0) {
                  api.staticFile.searchLoactions.push(potentialPluginPath)
                }
              })
            }
          })
        }
      })
    }

    api.log('Static files will be served from these directories', 'debug', api.staticFile.searchLoactions)
    next()
  }
}
