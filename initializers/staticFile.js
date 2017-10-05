'use strict'

const fs = require('fs')
const path = require('path')
const Mime = require('mime')
const {promisify} = require('util')
const ActionHero = require('./../index.js')
const api = ActionHero.api

function asyncStats (file) {
  return promisify(fs.stat)(file)
}

function asyncReadLink (file) {
  return promisify(fs.readLink)(file)
}

/**
 * Countains helpers for returning flies to connections.
 *
 * @namespace api.staticFile
 * @property {Array} searchLoactions - This paths which can be searched for this file.  Comprised of paths from api.config.general.paths and plugins.
 * @extends ActionHero.Initializer
 */
module.exports = class StaticFile extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'staticFile'
    this.loadPriority = 510
  }

  initialize () {
    api.staticFile = {
      searchLoactions: []
    }

    // connection.params.file should be set
    // return is of the form: {connection, error, fileStream, mime, length}

    /**
     * For a connection with `connecton.params.file` set, return a file if we can find it, or a not-found message.
     * `searchLoactions` will be cheked in the following order: first paths in this project, then plugins.
     * This can be used in Actions to return files to clients.  If done, set `data.toRender = false` within the action.
     *
     * @async
     * @param  {Object}  connection An ActionHero.Connection
     * @param  {Nmbber}  counter    (do not set) An internal couner to track which path we should check on (recursive)
     * @return {Promise<Object>}    Returns a collection of metadata and a FileStream: {connection, fileStream, mime, length, lastModified}
     */
    api.staticFile.get = async (connection, counter) => {
      let file

      if (!counter) { counter = 0 }
      if (!connection.params.file || !api.staticFile.searchPath(connection, counter)) {
        return api.staticFile.sendFileNotFound(connection, await api.config.errors.fileNotProvided(connection))
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
    }

    api.staticFile.searchPath = (connection, counter) => {
      if (!counter) { counter = 0 }
      if (api.staticFile.searchLoactions.length === 0 || counter >= api.staticFile.searchLoactions.length) {
        return null
      } else {
        return api.staticFile.searchLoactions[counter]
      }
    }

    api.staticFile.sendFile = async (file, connection) => {
      let lastModified

      try {
        let stats = await asyncStats(file)
        let mime = Mime.getType(file)
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
        return api.staticFile.sendFileNotFound(connection, await api.config.errors.fileReadError(connection, String(error)))
      }
    }

    api.staticFile.fileLogger = (fileStream, connection, start, file, length) => {
      fileStream.on('end', () => {
        let duration = new Date().getTime() - start
        api.staticFile.logRequest(file, connection, length, duration, true)
      })

      fileStream.on('error', (error) => {
        throw error
      })
    }

    api.staticFile.sendFileNotFound = async (connection, errorMessage) => {
      connection.error = new Error(errorMessage)
      api.staticFile.logRequest('{not found}', connection, null, null, false)
      return {
        connection,
        error: await api.config.errors.fileNotFound(connection),
        mime: 'text/html',
        length: await api.config.errors.fileNotFound(connection).length
      }
    }

    api.staticFile.checkExistence = async (file) => {
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
    }

    api.staticFile.logRequest = (file, connection, length, duration, success) => {
      api.log(`[ file @ ${connection.type} ]`, api.config.general.fileRequestLogLevel, {
        to: connection.remoteIP,
        file: file,
        requestedFile: connection.params.file,
        size: length,
        duration: duration,
        success: success
      })
    }

    // load in the explicit public paths first
    if (api.config.general.paths !== undefined) {
      api.config.general.paths['public'].forEach(function (p) {
        api.staticFile.searchLoactions.push(path.normalize(p))
      })
    }

    // source the public directories from plugins
    for (let pluginName in api.config.plugins) {
      if (api.config.plugins[pluginName].public !== false) {
        let pluginPublicPath = path.join(api.config.plugins[pluginName].path, 'public')
        if (fs.existsSync(pluginPublicPath) && api.staticFile.searchLoactions.indexOf(pluginPublicPath) < 0) {
          api.staticFile.searchLoactions.push(pluginPublicPath)
        }
      }
    }

    api.log('static files will be served from these directories', 'debug', api.staticFile.searchLoactions)
  }
}
