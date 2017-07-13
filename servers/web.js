'use strict'

const url = require('url')
const qs = require('qs')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const formidable = require('formidable')
const browserFingerprint = require('browser_fingerprint')
const Mime = require('mime')
const uuid = require('uuid')
const etag = require('etag')

const initialize = function (api, options, next) {
  // ////////
  // INIT //
  // ////////

  const type = 'web'
  const attributes = {
    canChat: false,
    logConnections: false,
    logExits: false,
    sendWelcomeMessage: false,
    verbs: [
      // no verbs for connections of this type, as they are to be very short-lived
    ]
  }

  const server = new api.GenericServer(type, options, attributes)

  if (['api', 'file'].indexOf(api.config.servers.web.rootEndpointType) < 0) {
    throw new Error('api.config.servers.web.rootEndpointType can only be \'api\' or \'file\'')
  }

  // ////////////////////
  // REQUIRED METHODS //
  // ////////////////////

  server.start = function (next) {
    if (options.secure === false) {
      const http = require('http')
      server.server = http.createServer((req, res) => {
        handleRequest(req, res)
      })
    } else {
      const https = require('https')
      server.server = https.createServer(api.config.servers.web.serverOptions, (req, res) => {
        handleRequest(req, res)
      })
    }

    let bootAttempts = 0
    server.server.on('error', (e) => {
      bootAttempts++
      if (bootAttempts < api.config.servers.web.bootAttempts) {
        server.log('cannot boot web server; trying again [' + String(e) + ']', 'error')
        if (bootAttempts === 1) { cleanSocket(options.bindIP, options.port) }
        setTimeout(() => {
          server.log('attempting to boot again..')
          server.server.listen(options.port, options.bindIP)
        }, 1000)
      } else {
        return next(new Error('cannot start web server @ ' + options.bindIP + ':' + options.port + ' => ' + e.message))
      }
    })

    server.server.listen(options.port, options.bindIP, () => {
      chmodSocket(options.bindIP, options.port)
      next()
    })
  }

  server.stop = function (next) {
    if (server.server) { server.server.close() }
    process.nextTick(next)
  }

  server.sendMessage = function (connection, message) {
    let stringResponse = ''
    if (connection.rawConnection.method !== 'HEAD') {
      stringResponse = String(message)
    }

    cleanHeaders(connection)
    const headers = connection.rawConnection.responseHeaders
    const responseHttpCode = parseInt(connection.rawConnection.responseHttpCode)

    server.sendWithCompression(connection, responseHttpCode, headers, stringResponse)
  }

  server.sendFile = function (connection, error, fileStream, mime, length, lastModified) {
    let foundCacheControl = false
    let ifModifiedSince
    let reqHeaders

    connection.rawConnection.responseHeaders.forEach((pair) => {
      if (pair[0].toLowerCase() === 'cache-control') { foundCacheControl = true }
    })

    connection.rawConnection.responseHeaders.push(['Content-Type', mime])

    if (fileStream) {
      if (!foundCacheControl) { connection.rawConnection.responseHeaders.push(['Cache-Control', 'max-age=' + api.config.servers.web.flatFileCacheDuration + ', must-revalidate, public']) }
    }
    if (fileStream && !api.config.servers.web.enableEtag) {
      if (lastModified) { connection.rawConnection.responseHeaders.push(['Last-Modified', new Date(lastModified).toUTCString()]) }
    }

    cleanHeaders(connection)
    const headers = connection.rawConnection.responseHeaders
    reqHeaders = connection.rawConnection.req.headers

    let sendRequestResult = function () {
      let responseHttpCode = parseInt(connection.rawConnection.responseHttpCode, 10)
      if (error) {
        server.sendWithCompression(connection, responseHttpCode, headers, String(error))
      } else if (responseHttpCode !== 304) {
        server.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length)
      } else {
        connection.rawConnection.res.writeHead(responseHttpCode, transformHeaders(headers))
        connection.rawConnection.res.end()
        connection.destroy()
      }
    }

    if (error) {
      connection.rawConnection.responseHttpCode = 404
      return sendRequestResult()
    }

    if (reqHeaders['if-modified-since']) {
      ifModifiedSince = new Date(reqHeaders['if-modified-since'])
      lastModified.setMilliseconds(0)
      if (lastModified <= ifModifiedSince) { connection.rawConnection.responseHttpCode = 304 }
      return sendRequestResult()
    }

    if (api.config.servers.web.enableEtag && fileStream && fileStream.path) {
      fs.stat(fileStream.path, (error, filestats) => {
        if (error) {
          server.log('Error receving file statistics: ' + String(error), 'error')
          return sendRequestResult()
        }
        const fileEtag = etag(filestats, {weak: true})
        connection.rawConnection.responseHeaders.push(['ETag', fileEtag])
        let noneMatchHeader = reqHeaders['if-none-match']
        let cacheCtrlHeader = reqHeaders['cache-control']
        let noCache = false
        let etagMatches
        // check for no-cache cache request directive
        if (cacheCtrlHeader && cacheCtrlHeader.indexOf('no-cache') !== -1) {
          noCache = true
        }
        // parse if-none-match
        if (noneMatchHeader) { noneMatchHeader = noneMatchHeader.split(/ *, */) }
        // if-none-match
        if (noneMatchHeader) {
          etagMatches = noneMatchHeader.some((match) => {
            return match === '*' || match === fileEtag || match === 'W/' + fileEtag
          })
        }
        if (etagMatches && !noCache) {
          connection.rawConnection.responseHttpCode = 304
        }
        sendRequestResult()
      })
    } else {
      sendRequestResult()
    }
  }

  server.sendWithCompression = function (connection, responseHttpCode, headers, stringResponse, fileStream, fileLength) {
    let acceptEncoding = connection.rawConnection.req.headers['accept-encoding']
    let compressor
    let stringEncoder
    if (!acceptEncoding) { acceptEncoding = '' }

    // Note: this is not a conformant accept-encoding parser.
    // https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (api.config.servers.web.compress === true) {
      let gzipMatch = acceptEncoding.match(/\bgzip\b/)
      let deflateMatch = acceptEncoding.match(/\bdeflate\b/)
      if ((gzipMatch && !deflateMatch) || (gzipMatch && deflateMatch && gzipMatch.index < deflateMatch.index)) {
        headers.push(['Content-Encoding', 'gzip'])
        compressor = zlib.createGzip()
        stringEncoder = zlib.gzip
      } else if ((!gzipMatch && deflateMatch) || (gzipMatch && deflateMatch && deflateMatch.index < gzipMatch.index)) {
        headers.push(['Content-Encoding', 'deflate'])
        compressor = zlib.createDeflate()
        stringEncoder = zlib.deflate
      }
    }

    // the 'finish' event deontes a successful transfer
    connection.rawConnection.res.on('finish', () => {
      connection.destroy()
    })

    // the 'close' event deontes a failed transfer, but it is probably the client's fault
    connection.rawConnection.res.on('close', () => {
      connection.destroy()
    })

    if (fileStream) {
      if (compressor) {
        // headers.push(['Content-Length', fileLength]); // TODO
        connection.rawConnection.res.writeHead(responseHttpCode, transformHeaders(headers))
        fileStream.pipe(compressor).pipe(connection.rawConnection.res)
      } else {
        // file length might be null if we don't know how long the stream is
        if (fileLength) {
          headers.push(['Content-Length', fileLength])
        }
        connection.rawConnection.res.writeHead(responseHttpCode, transformHeaders(headers))
        fileStream.pipe(connection.rawConnection.res)
      }
    } else {
      if (stringEncoder) {
        stringEncoder(stringResponse, (error, zippedString) => {
          if (error) { console.error(error) }
          headers.push(['Content-Length', zippedString.length])
          connection.rawConnection.res.writeHead(responseHttpCode, transformHeaders(headers))
          connection.rawConnection.res.end(zippedString)
        })
      } else {
        headers.push(['Content-Length', Buffer.byteLength(stringResponse)])
        connection.rawConnection.res.writeHead(responseHttpCode, transformHeaders(headers))
        connection.rawConnection.res.end(stringResponse)
      }
    }
  }

  server.goodbye = function () {
    // disconnect handlers
  }

  server.connectionCustomMethods = {
    setHeader: function (connection, key, value) {
      connection.rawConnection.res.setHeader(key, value)
    }
  }

  // //////////
  // EVENTS //
  // //////////

  server.on('connection', (connection) => {
    determineRequestParams(connection, (requestMode) => {
      if (requestMode === 'api') {
        server.processAction(connection)
      } else if (requestMode === 'file') {
        server.processFile(connection)
      } else if (requestMode === 'options') {
        respondToOptions(connection)
      } else if (requestMode === 'trace') {
        respondToTrace(connection)
      }
    })
  })

  server.on('actionComplete', (data) => {
    completeResponse(data)
  })

  // ///////////
  // HELPERS //
  // ///////////

  const handleRequest = function (req, res) {
    browserFingerprint.fingerprint(req, api.config.servers.web.fingerprintOptions, (error, fingerprint, elementHash, cookieHash) => {
      if (error) throw error

      let responseHeaders = []
      let cookies = api.utils.parseCookies(req)
      let responseHttpCode = 200
      let method = req.method.toUpperCase()
      let parsedURL = url.parse(req.url, true)
      let i
      for (i in cookieHash) {
        responseHeaders.push([i, cookieHash[i]])
      }

      // https://github.com/actionhero/actionhero/issues/189
      responseHeaders.push(['Content-Type', 'application/json; charset=utf-8'])

      for (i in api.config.servers.web.httpHeaders) {
        if (api.config.servers.web.httpHeaders[i]) {
          responseHeaders.push([i, api.config.servers.web.httpHeaders[i]])
        }
      }

      let remoteIP = req.connection.remoteAddress
      let remotePort = req.connection.remotePort

      // helpers for unix socket bindings with no forward
      if (!remoteIP && !remotePort) {
        remoteIP = '0.0.0.0'
        remotePort = '0'
      }

      if (req.headers['x-forwarded-for']) {
        let parts
        let forwardedIp = req.headers['x-forwarded-for'].split(',')[0]
        if (forwardedIp.indexOf('.') >= 0 || (forwardedIp.indexOf('.') < 0 && forwardedIp.indexOf(':') < 0)) {
          // IPv4
          forwardedIp = forwardedIp.replace('::ffff:', '') // remove any IPv6 information, ie: '::ffff:127.0.0.1'
          parts = forwardedIp.split(':')
          if (parts[0]) { remoteIP = parts[0] }
          if (parts[1]) { remotePort = parts[1] }
        } else {
          // IPv6
          parts = api.utils.parseIPv6URI(forwardedIp)
          if (parts.host) { remoteIP = parts.host }
          if (parts.port) { remotePort = parts.port }
        }

        if (req.headers['x-forwarded-port']) {
          remotePort = req.headers['x-forwarded-port']
        }
      }

      if (api.config.servers.web.allowedRequestHosts && api.config.servers.web.allowedRequestHosts.length > 0) {
        let guess = 'http://'
        if (options.secure) { guess = 'https://' }
        let fullRequestHost = (req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' : guess) + req.headers.host
        if (api.config.servers.web.allowedRequestHosts.indexOf(fullRequestHost) < 0) {
          let newHost = api.config.servers.web.allowedRequestHosts[0]
          res.statusCode = 302
          res.setHeader('Location', newHost + req.url)
          return res.end(`You are being redirected to ${newHost + req.url}\r\n`)
        }
      }

      server.buildConnection({
        // will emit 'connection'
        rawConnection: {
          req: req,
          res: res,
          params: {},
          method: method,
          cookies: cookies,
          responseHeaders: responseHeaders,
          responseHttpCode: responseHttpCode,
          parsedURL: parsedURL
        },
        id: fingerprint + '-' + uuid.v4(),
        fingerprint: fingerprint,
        remoteAddress: remoteIP,
        remotePort: remotePort
      })
    })
  }

  const completeResponse = function (data) {
    if (data.toRender !== true) {
      if (data.connection.rawConnection.res.finished) {
        data.connection.destroy()
      } else {
        data.connection.rawConnection.res.on('finish', () => data.connection.destroy())
        data.connection.rawConnection.res.on('close', () => data.connection.destroy())
      }

      return
    }

    if (api.config.servers.web.metadataOptions.serverInformation && typeof data.response !== 'string') {
      const stopTime = new Date().getTime()
      data.response.serverInformation = {
        serverName: api.config.general.serverName,
        apiVersion: api.config.general.apiVersion,
        requestDuration: (stopTime - data.connection.connectedAt),
        currentTime: stopTime
      }
    }

    if (api.config.servers.web.metadataOptions.requesterInformation && typeof data.response !== 'string') {
      data.response.requesterInformation = buildRequesterInformation(data.connection)
    }

    if (data.response.error) {
      if (api.config.servers.web.returnErrorCodes === true && data.connection.rawConnection.responseHttpCode === 200) {
        if (data.actionStatus === 'unknown_action') {
          data.connection.rawConnection.responseHttpCode = 404
        } else if (data.actionStatus === 'missing_params') {
          data.connection.rawConnection.responseHttpCode = 422
        } else if (data.actionStatus === 'server_error') {
          data.connection.rawConnection.responseHttpCode = 500
        } else {
          data.connection.rawConnection.responseHttpCode = 400
        }
      }
    }

    if (
        !data.response.error &&
        data.action &&
        data.params.apiVersion &&
        api.actions.actions[data.params.action][data.params.apiVersion].matchExtensionMimeType === true &&
        data.connection.extension
      ) {
      data.connection.rawConnection.responseHeaders.push(['Content-Type', Mime.lookup(data.connection.extension)])
    }

    if (data.response.error) {
      data.response.error = api.config.errors.serializers.servers.web(data.response.error)
    }

    let stringResponse = ''

    if (extractHeader(data.connection, 'Content-Type').match(/json/)) {
      stringResponse = JSON.stringify(data.response, null, api.config.servers.web.padding)
      if (data.params.callback) {
        data.connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript'])
        stringResponse = callbackHtmlEscape(data.connection.params.callback) + '(' + stringResponse + ');'
      }
    } else {
      stringResponse = data.response
    }

    server.sendMessage(data.connection, stringResponse)
  }

  const extractHeader = function (connection, match) {
    let i = connection.rawConnection.responseHeaders.length - 1
    while (i >= 0) {
      if (connection.rawConnection.responseHeaders[i][0].toLowerCase() === match.toLowerCase()) {
        return connection.rawConnection.responseHeaders[i][1]
      }
      i--
    }
    return null
  }

  const respondToOptions = function (connection) {
    if (!api.config.servers.web.httpHeaders['Access-Control-Allow-Methods'] && !extractHeader(connection, 'Access-Control-Allow-Methods')) {
      const methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE'
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods])
    }
    if (!api.config.servers.web.httpHeaders['Access-Control-Allow-Origin'] && !extractHeader(connection, 'Access-Control-Allow-Origin')) {
      const origin = '*'
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Origin', origin])
    }
    server.sendMessage(connection, '')
  }

  const respondToTrace = function (connection) {
    const data = buildRequesterInformation(connection)
    const stringResponse = JSON.stringify(data, null, api.config.servers.web.padding)
    server.sendMessage(connection, stringResponse)
  }

  const determineRequestParams = function (connection, callback) {
    // determine file or api request
    let requestMode = api.config.servers.web.rootEndpointType
    let pathname = connection.rawConnection.parsedURL.pathname
    let pathParts = pathname.split('/')
    let matcherLength
    let i
    while (pathParts[0] === '') { pathParts.shift() }
    if (pathParts[pathParts.length - 1] === '') { pathParts.pop() }

    if (pathParts[0] && pathParts[0] === api.config.servers.web.urlPathForActions) {
      requestMode = 'api'
      pathParts.shift()
    } else if (pathParts[0] && pathParts[0] === api.config.servers.web.urlPathForFiles) {
      requestMode = 'file'
      pathParts.shift()
    } else if (pathParts[0] && pathname.indexOf(api.config.servers.web.urlPathForActions) === 0) {
      requestMode = 'api'
      matcherLength = api.config.servers.web.urlPathForActions.split('/').length
      for (i = 0; i < (matcherLength - 1); i++) { pathParts.shift() }
    } else if (pathParts[0] && pathname.indexOf(api.config.servers.web.urlPathForFiles) === 0) {
      requestMode = 'file'
      matcherLength = api.config.servers.web.urlPathForFiles.split('/').length
      for (i = 0; i < (matcherLength - 1); i++) { pathParts.shift() }
    }

    let extensionParts = connection.rawConnection.parsedURL.pathname.split('.')
    if (extensionParts.length > 1) {
      connection.extension = extensionParts[(extensionParts.length - 1)]
    }

    // OPTIONS
    if (connection.rawConnection.method === 'OPTIONS') {
      requestMode = 'options'
      callback(requestMode)

    // API
    } else if (requestMode === 'api') {
      if (connection.rawConnection.method === 'TRACE') { requestMode = 'trace' }
      let search = connection.rawConnection.parsedURL.search.slice(1)
      fillParamsFromWebRequest(connection, qs.parse(search, api.config.servers.web.queryParseOptions))
      connection.rawConnection.params.query = connection.rawConnection.parsedURL.query
      if (
          connection.rawConnection.method !== 'GET' &&
          connection.rawConnection.method !== 'HEAD' &&
          (
            connection.rawConnection.req.headers['content-type'] ||
            connection.rawConnection.req.headers['Content-Type']
          )
      ) {
        connection.rawConnection.form = new formidable.IncomingForm()
        for (i in api.config.servers.web.formOptions) {
          connection.rawConnection.form[i] = api.config.servers.web.formOptions[i]
        }

        let rawBody = Buffer.alloc(0)
        if (api.config.servers.web.saveRawBody) {
          connection.rawConnection.req.on('data', (chunk) => { rawBody = Buffer.concat([rawBody, chunk]) })
        }

        connection.rawConnection.form.parse(connection.rawConnection.req, (error, fields, files) => {
          if (error) {
            server.log('error processing form: ' + String(error), 'error')
            connection.error = new Error('There was an error processing this form.')
          } else {
            connection.rawConnection.params.body = fields
            connection.rawConnection.params.rawBody = rawBody
            connection.rawConnection.params.files = files
            fillParamsFromWebRequest(connection, files)
            fillParamsFromWebRequest(connection, fields)
          }
          if (api.config.servers.web.queryRouting !== true) { connection.params.action = null }
          api.routes.processRoute(connection, pathParts)
          callback(requestMode)
        })
      } else {
        if (api.config.servers.web.queryRouting !== true) { connection.params.action = null }
        api.routes.processRoute(connection, pathParts)
        callback(requestMode)
      }

    // FILE
    } else if (requestMode === 'file') {
      api.routes.processRoute(connection, pathParts)
      if (!connection.params.file) {
        connection.params.file = pathParts.join(path.sep)
      }
      if (connection.params.file === '' || connection.params.file[connection.params.file.length - 1] === '/') {
        connection.params.file = connection.params.file + api.config.general.directoryFileType
      }
      try {
        connection.params.file = decodeURIComponent(connection.params.file)
      } catch (e) {
        connection.error = new Error('There was an error decoding URI: ' + e)
      }
      callback(requestMode)
    }
  }

  const fillParamsFromWebRequest = function (connection, varsHash) {
    // helper for JSON posts
    let collapsedVarsHash = api.utils.collapseObjectToArray(varsHash)
    if (collapsedVarsHash !== false) {
      varsHash = {payload: collapsedVarsHash} // post was an array, lets call it "payload"
    }

    for (let v in varsHash) {
      connection.params[v] = varsHash[v]
    }
  }

  const transformHeaders = function (headersArray) {
    return headersArray.reduce((headers, currentHeader) => {
      let currentHeaderKey = currentHeader[0].toLowerCase()
      // we have a set-cookie, let's see what we have to do
      if (currentHeaderKey === 'set-cookie') {
        if (headers[currentHeaderKey]) {
          headers[currentHeaderKey].push(currentHeader[1])
        } else {
          headers[currentHeaderKey] = [currentHeader[1]]
        }
      } else {
        headers[currentHeaderKey] = currentHeader[1]
      }

      return headers
    }, {})
  }

  const buildRequesterInformation = function (connection) {
    let requesterInformation = {
      id: connection.id,
      fingerprint: connection.fingerprint,
      remoteIP: connection.remoteIP,
      receivedParams: {}
    }

    for (let p in connection.params) {
      if (api.config.general.disableParamScrubbing === true || api.params.postVariables.indexOf(p) >= 0) {
        requesterInformation.receivedParams[p] = connection.params[p]
      }
    }

    return requesterInformation
  }

  const cleanHeaders = function (connection) {
    const originalHeaders = connection.rawConnection.responseHeaders.reverse()
    let foundHeaders = []
    let cleanedHeaders = []
    for (let i in originalHeaders) {
      let key = originalHeaders[i][0]
      let value = originalHeaders[i][1]
      if (foundHeaders.indexOf(key.toLowerCase()) >= 0 && key.toLowerCase().indexOf('set-cookie') < 0) {
        // ignore, it's a duplicate
      } else if (connection.rawConnection.method === 'HEAD' && key === 'Transfer-Encoding') {
        // ignore, we can't send this header for HEAD requests
      } else {
        foundHeaders.push(key.toLowerCase())
        cleanedHeaders.push([key, value])
      }
    }
    connection.rawConnection.responseHeaders = cleanedHeaders
  }

  const cleanSocket = function (bindIP, port) {
    if (!bindIP && typeof port === 'string' && port.indexOf('/') >= 0) {
      fs.unlink(port, (error) => {
        if (error) {
          server.log('cannot remove stale socket @' + port + ' : ' + error)
        } else {
          server.log('removed stale unix socket @ ' + port)
        }
      })
    }
  }

  const chmodSocket = function (bindIP, port) {
    if (!bindIP && typeof port === 'string' && port.indexOf('/') >= 0) {
      fs.chmodSync(port, '0777')
    }
  }

  next(server)
}

function callbackHtmlEscape (str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\)/g, '')
    .replace(/\(/g, '')
}

// ///////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize
