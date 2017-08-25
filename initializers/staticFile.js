'use strict'

const fs = require('fs')
const path = require('path')
const Mime = require('mime')

function asyncStats (file) {
  return new Promise((resolve, reject) => {
    fs.stat(file, (error, stats) => {
      if (error) { return reject(error) }
      resolve(stats)
    })
  })
}

function asyncReadLink (file) {
  return new Promise((resolve, reject) => {
    fs.readLink(file, (error, truePath) => {
      if (error) { return reject(error) }
      resolve(truePath)
    })
  })
}

module.exports = {
  loadPriority: 510,
  initialize: function (api, next) {
    api.staticFile = {

      searchLoactions: [],

      // connection.params.file should be set
      // return is of the form: {connection, error, fileStream, mime, length}
      get: async (connection, counter) => {
        let file

        if (!counter) { counter = 0 }
        if (!connection.params.file || !api.staticFile.searchPath(connection, counter)) {
          return api.staticFile.sendFileNotFound(connection, api.config.errors.fileNotProvided(connection))
        }

        if (!path.isAbsolute(connection.params.file)) {
          file = path.normalize(
            path.join(api.staticFile.searchPath(connection, counter), connection.params.file)
          )
        } else {
          file = connection.params.file
        }

        if (file.indexOf(path.normalize(api.staticFile.searchPath(connection, counter))) !== 0) {
          return api.staticFile.get(connection, counter + 1)
        } else {
          let {exists, truePath} = await api.staticFile.checkExistence(file)
          if (exists) {
            return api.staticFile.sendFile(truePath, connection)
          } else {
            return api.staticFile.get(connection, counter + 1)
          }
        }
      },

      searchPath: (connection, counter) => {
        if (!counter) { counter = 0 }
        if (api.staticFile.searchLoactions.length === 0 || counter >= api.staticFile.searchLoactions.length) {
          return null
        } else {
          return api.staticFile.searchLoactions[counter]
        }
      },

      sendFile: async (file, connection) => {
        let lastModified

        try {
          let stats = await asyncStats(file)
          let mime = Mime.lookup(file)
          let length = stats.size
          let start = new Date().getTime()
          lastModified = stats.mtime

          let fileStream = fs.createReadStream(file)
          api.staticFile.fileLogger(fileStream, connection, start, file, length)

          await new Promise((resolve) => {
            fileStream.on('open', () => { resolve() })
          })

          return {connection, fileStream, mime, length, lastModified}
        } catch (error) {
          return api.staticFile.sendFileNotFound(connection, api.config.errors.fileReadError(connection, String(error)))
        }
      },

      fileLogger: (fileStream, connection, start, file, length) => {
        fileStream.on('end', () => {
          let duration = new Date().getTime() - start
          api.staticFile.logRequest(file, connection, length, duration, true)
        })

        fileStream.on('error', (error) => {
          throw error
        })
      },

      sendFileNotFound: async (connection, errorMessage) => {
        connection.error = new Error(errorMessage)
        api.staticFile.logRequest('{not found}', connection, null, null, false)
        return {
          connection,
          error: api.config.errors.fileNotFound(connection),
          mime: 'text/html',
          length: api.config.errors.fileNotFound(connection).length
        }
      },

      checkExistence: async (file) => {
        try {
          let stats = await asyncStats(file)

          if (stats.isDirectory()) {
            let indexPath = file + '/' + api.config.general.directoryFileType
            return api.staticFile.checkExistence(indexPath)
          }

          if (stats.isSymbolicLink()) {
            let truePath = await asyncReadLink(file)
            truePath = path.normalize(truePath)
            return api.staticFile.checkExistence(truePath)
          }

          if (stats.isFile()) {
            return {exists: true, truePath: file}
          }

          return {exists: false, truePath: file}
        } catch (error) {
          return {exists: false, truePath: file}
        }
      },

      logRequest: (file, connection, length, duration, success) => {
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
