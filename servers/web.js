'use strict'

const http = require('http')
const https = require('https')
const url = require('url')
const qs = require('qs')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const formidable = require('formidable')
const BrowserFingerprint = require('browser_fingerprint')
const Mime = require('mime')
const uuid = require('uuid')
const etag = require('etag')
const ActionHero = require('./../index.js')
const api = ActionHero.api

module.exports = class WebServer extends ActionHero.Server {
  constructor () {
    super()
    this.type = 'web'

    this.attributes = {
      canChat: false,
      logConnections: false,
      logExits: false,
      sendWelcomeMessage: false,
      verbs: [] // no verbs for connections of this type, as they are to be very short-lived
    }

    this.connectionCustomMethods = {
      setHeader: (connection, key, value) => {
        connection.rawConnection.res.setHeader(key, value)
      },

      setStatusCode: (connection, value) => {
        connection.rawConnection.responseHttpCode = value
      },

      pipe: (connection, buffer, headers) => {
        for (const k in headers) { connection.setHeader(k, headers[k]) }
        if (typeof buffer === 'string') { buffer = Buffer.from(buffer) }
        connection.rawConnection.res.end(buffer)
      }
    }
  }

  async initialize () {
    if (['api', 'file'].indexOf(this.config.rootEndpointType) < 0) {
      throw new Error('rootEndpointType can only be \'api\' or \'file\'')
    }

    if (!this.config.urlPathForFiles && this.config.rootEndpointType === 'file') {
      throw new Error('rootEndpointType cannot be "file" without a urlPathForFiles')
    }

    this.fingerprinter = new BrowserFingerprint(this.config.fingerprintOptions)
  }

  async start () {
    let bootAttempts = 0
    if (this.config.secure === false) {
      this.server = http.createServer((req, res) => { this.handleRequest(req, res) })
    } else {
      this.server = https.createServer(this.config.serverOptions, (req, res) => { this.handleRequest(req, res) })
    }

    this.server.on('error', (error) => {
      bootAttempts++
      if (bootAttempts < this.config.bootAttempts) {
        this.log(`cannot boot web server; trying again [${error}]`, 'error')
        if (bootAttempts === 1) { this.cleanSocket(this.config.bindIP, this.config.port) }
        setTimeout(() => {
          this.log('attempting to boot again..')
          this.server.listen(this.config.port, this.config.bindIP)
        }, 1000)
      } else {
        throw new Error(`cannot start web server @ ${this.config.bindIP}:${this.config.port} => ${error}`)
      }
    })

    await new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.bindIP, () => {
        this.chmodSocket(this.config.bindIP, this.config.port)
        resolve()
      })
    })

    this.on('connection', async (connection) => {
      const requestMode = await this.determineRequestParams(connection)
      if (requestMode === 'api') {
        this.processAction(connection)
      } else if (requestMode === 'file') {
        this.processFile(connection)
      } else if (requestMode === 'options') {
        this.respondToOptions(connection)
      } else if (requestMode === 'trace') {
        this.respondToTrace(connection)
      }
    })

    this.on('actionComplete', this.completeResponse)
  }

  stop () {
    if (this.server) { this.server.close() }
  }

  sendMessage (connection, message) {
    let stringResponse = ''
    if (connection.rawConnection.method !== 'HEAD') {
      stringResponse = String(message)
    }

    this.cleanHeaders(connection)
    const headers = connection.rawConnection.responseHeaders
    const responseHttpCode = parseInt(connection.rawConnection.responseHttpCode)

    this.sendWithCompression(connection, responseHttpCode, headers, stringResponse)
  }

  async sendFile (connection, error, fileStream, mime, length, lastModified) {
    let foundCacheControl = false
    let ifModifiedSince

    connection.rawConnection.responseHeaders.forEach((pair) => {
      if (pair[0].toLowerCase() === 'cache-control') { foundCacheControl = true }
    })

    connection.rawConnection.responseHeaders.push(['Content-Type', mime])

    if (fileStream) {
      if (!foundCacheControl) { connection.rawConnection.responseHeaders.push(['Cache-Control', 'max-age=' + this.config.flatFileCacheDuration + ', must-revalidate, public']) }
    }

    if (fileStream && !this.config.enableEtag) {
      if (lastModified) { connection.rawConnection.responseHeaders.push(['Last-Modified', new Date(lastModified).toUTCString()]) }
    }

    this.cleanHeaders(connection)
    const headers = connection.rawConnection.responseHeaders
    const reqHeaders = connection.rawConnection.req.headers

    const sendRequestResult = () => {
      const responseHttpCode = parseInt(connection.rawConnection.responseHttpCode, 10)
      if (error) {
        this.sendWithCompression(connection, responseHttpCode, headers, String(error))
      } else if (responseHttpCode !== 304) {
        this.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length)
      } else {
        connection.rawConnection.res.writeHead(responseHttpCode, this.transformHeaders(headers))
        connection.rawConnection.res.end()
        connection.destroy()
        fileStream.close()
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

    if (this.config.enableEtag && fileStream && fileStream.path) {
      const filestats = await new Promise((resolve) => {
        fs.stat(fileStream.path, (error, filestats) => {
          if (error || !filestats) { this.log('Error receving file statistics: ' + String(error), 'error') }
          return resolve(filestats)
        })
      })

      if (!filestats) { return sendRequestResult() }

      const fileEtag = etag(filestats, { weak: true })
      connection.rawConnection.responseHeaders.push(['ETag', fileEtag])
      let noneMatchHeader = reqHeaders['if-none-match']
      const cacheCtrlHeader = reqHeaders['cache-control']
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
    } else {
      sendRequestResult()
    }
  }

  sendWithCompression (connection, responseHttpCode, headers, stringResponse, fileStream, fileLength) {
    let acceptEncoding = connection.rawConnection.req.headers['accept-encoding']
    let compressor
    let stringEncoder
    if (!acceptEncoding) { acceptEncoding = '' }

    // Note: this is not a conformant accept-encoding parser.
    // https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (this.config.compress === true) {
      const gzipMatch = acceptEncoding.match(/\bgzip\b/)
      const deflateMatch = acceptEncoding.match(/\bdeflate\b/)
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
        connection.rawConnection.res.writeHead(responseHttpCode, this.transformHeaders(headers))
        fileStream.pipe(compressor).pipe(connection.rawConnection.res)
      } else {
        if (fileLength) { headers.push(['Content-Length', fileLength]) }
        connection.rawConnection.res.writeHead(responseHttpCode, this.transformHeaders(headers))
        fileStream.pipe(connection.rawConnection.res)
      }
    } else {
      if (stringEncoder) {
        stringEncoder(stringResponse, (error, zippedString) => {
          if (error) { console.error(error) }
          headers.push(['Content-Length', zippedString.length])
          connection.rawConnection.res.writeHead(responseHttpCode, this.transformHeaders(headers))
          connection.rawConnection.res.end(zippedString)
        })
      } else {
        headers.push(['Content-Length', Buffer.byteLength(stringResponse)])
        connection.rawConnection.res.writeHead(responseHttpCode, this.transformHeaders(headers))
        connection.rawConnection.res.end(stringResponse)
      }
    }
  }

  handleRequest (req, res) {
    const { fingerprint, headersHash } = this.fingerprinter.fingerprint(req)
    const responseHeaders = []
    const cookies = api.utils.parseCookies(req)
    const responseHttpCode = 200
    const method = req.method.toUpperCase()

    // waiting until URL() can handle relative paths
    // https://github.com/nodejs/node/issues/12682
    const parsedURL = url.parse(req.url, true) //eslint-disable-line
    let i
    for (i in headersHash) {
      responseHeaders.push([i, headersHash[i]])
    }

    // https://github.com/actionhero/actionhero/issues/189
    responseHeaders.push(['Content-Type', 'application/json; charset=utf-8'])

    for (i in this.config.httpHeaders) {
      if (this.config.httpHeaders[i]) {
        responseHeaders.push([i, this.config.httpHeaders[i]])
      }
    }

    if (this.config.allowedRequestHosts && this.config.allowedRequestHosts.length > 0) {
      let guess = 'http://'
      if (this.config.secure) { guess = 'https://' }
      const fullRequestHost = (req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' : guess) + req.headers.host
      if (this.config.allowedRequestHosts.indexOf(fullRequestHost) < 0) {
        const newHost = this.config.allowedRequestHosts[0]
        res.statusCode = 302
        res.setHeader('Location', newHost + req.url)
        return res.end(`You are being redirected to ${newHost + req.url}\r\n`)
      }
    }

    const { ip, port } = api.utils.parseHeadersForClientAddress(req.headers)
    const messageId = uuid.v4()

    this.buildConnection({
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
      id: `${fingerprint}-${messageId}`,
      messageId: messageId,
      fingerprint: fingerprint,
      remoteAddress: ip || req.connection.remoteAddress || '0.0.0.0',
      remotePort: port || req.connection.remotePort || '0'
    })
  }

  async completeResponse (data) {
    if (data.toRender !== true) {
      if (data.connection.rawConnection.res.finished) {
        data.connection.destroy()
      } else {
        data.connection.rawConnection.res.on('finish', () => data.connection.destroy())
        data.connection.rawConnection.res.on('close', () => data.connection.destroy())
      }

      return
    }

    if (this.config.metadataOptions.serverInformation && typeof data.response !== 'string') {
      const stopTime = new Date().getTime()
      data.response.serverInformation = {
        serverName: api.config.general.serverName,
        apiVersion: api.config.general.apiVersion,
        requestDuration: (stopTime - data.connection.connectedAt),
        currentTime: stopTime
      }
    }

    if (this.config.metadataOptions.requesterInformation && typeof data.response !== 'string') {
      data.response.requesterInformation = this.buildRequesterInformation(data.connection)
    }

    if (data.response.error) {
      if (this.config.returnErrorCodes === true && data.connection.rawConnection.responseHttpCode === 200) {
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
      const mime = Mime.getType(data.connection.extension)
      if (mime) { data.connection.rawConnection.responseHeaders.push(['Content-Type', mime]) }
    }

    if (data.response.error) {
      data.response.error = await api.config.errors.serializers.servers.web(data.response.error)
    }

    let stringResponse = ''

    if (this.extractHeader(data.connection, 'Content-Type').match(/json/)) {
      stringResponse = JSON.stringify(data.response, null, this.config.padding)
      if (data.params.callback) {
        data.connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript'])
        stringResponse = this.callbackHtmlEscape(data.connection.params.callback) + '(' + stringResponse + ');'
      }
    } else {
      stringResponse = data.response
    }

    this.sendMessage(data.connection, stringResponse)
  }

  extractHeader (connection, match) {
    let i = connection.rawConnection.responseHeaders.length - 1
    while (i >= 0) {
      if (connection.rawConnection.responseHeaders[i][0].toLowerCase() === match.toLowerCase()) {
        return connection.rawConnection.responseHeaders[i][1]
      }
      i--
    }
    return null
  }

  respondToOptions (connection) {
    if (!this.config.httpHeaders['Access-Control-Allow-Methods'] && !this.extractHeader(connection, 'Access-Control-Allow-Methods')) {
      const methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE'
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods])
    }

    if (!this.config.httpHeaders['Access-Control-Allow-Origin'] && !this.extractHeader(connection, 'Access-Control-Allow-Origin')) {
      const origin = '*'
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Origin', origin])
    }

    this.sendMessage(connection, '')
  }

  respondToTrace (connection) {
    const data = this.buildRequesterInformation(connection)
    const stringResponse = JSON.stringify(data, null, this.config.padding)
    this.sendMessage(connection, stringResponse)
  }

  async determineRequestParams (connection) {
    // determine file or api request
    let requestMode = this.config.rootEndpointType
    const pathname = connection.rawConnection.parsedURL.pathname
    const pathParts = pathname.split('/')
    let i

    while (pathParts[0] === '') { pathParts.shift() }
    if (pathParts[pathParts.length - 1] === '') { pathParts.pop() }

    let urlPathForActionsParts = []
    if (this.config.urlPathForActions) {
      urlPathForActionsParts = this.config.urlPathForActions.split('/')
      while (urlPathForActionsParts[0] === '') { urlPathForActionsParts.shift() }
    }

    let urlPathForFilesParts = []
    if (this.config.urlPathForFiles) {
      urlPathForFilesParts = this.config.urlPathForFiles.split('/')
      while (urlPathForFilesParts[0] === '') { urlPathForFilesParts.shift() }
    }

    if (pathParts[0] && api.utils.arrayStartingMatch(urlPathForActionsParts, pathParts)) {
      requestMode = 'api'
      for (i = 0; i < (urlPathForActionsParts.length); i++) { pathParts.shift() }
    } else if (pathParts[0] && api.utils.arrayStartingMatch(urlPathForFilesParts, pathParts)) {
      requestMode = 'file'
      for (i = 0; i < (urlPathForFilesParts.length); i++) { pathParts.shift() }
    }

    const extensionParts = connection.rawConnection.parsedURL.pathname.split('.')
    if (extensionParts.length > 1) {
      connection.extension = extensionParts[(extensionParts.length - 1)]
    }

    // OPTIONS
    if (connection.rawConnection.method === 'OPTIONS') {
      requestMode = 'options'
      return requestMode
    }

    // API
    if (requestMode === 'api') {
      if (connection.rawConnection.method === 'TRACE') { requestMode = 'trace' }

      let search = ''
      if (connection.rawConnection.parsedURL.search) {
        search = connection.rawConnection.parsedURL.search.slice(1)
      }

      this.fillParamsFromWebRequest(connection, qs.parse(search, this.config.queryParseOptions))
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
        for (i in this.config.formOptions) {
          connection.rawConnection.form[i] = this.config.formOptions[i]
        }

        let rawBody = Promise.resolve(Buffer.alloc(0))
        if (this.config.saveRawBody) {
          rawBody = new Promise((resolve, reject) => {
            let fullBody = Buffer.alloc(0)
            connection.rawConnection.req
              .on('data', (chunk) => { fullBody = Buffer.concat([fullBody, chunk]) })
              .on('end', () => { resolve(fullBody) })
          })
        }

        const { fields, files } = await new Promise((resolve) => {
          connection.rawConnection.form.parse(connection.rawConnection.req, (error, fields, files) => {
            if (error) {
              this.log('error processing form: ' + String(error), 'error')
              connection.error = new Error('There was an error processing this form.')
            }
            resolve({ fields, files })
          })
        })

        connection.rawConnection.params.body = fields
        connection.rawConnection.params.rawBody = await rawBody
        connection.rawConnection.params.files = files
        this.fillParamsFromWebRequest(connection, files)
        this.fillParamsFromWebRequest(connection, fields)

        if (this.config.queryRouting !== true) { connection.params.action = null }
        api.routes.processRoute(connection, pathParts)
        return requestMode
      } else {
        if (this.config.queryRouting !== true) { connection.params.action = null }
        api.routes.processRoute(connection, pathParts)
        return requestMode
      }
    }

    // FILE
    if (requestMode === 'file') {
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
      return requestMode
    }
  }

  fillParamsFromWebRequest (connection, varsHash) {
    // helper for JSON posts
    const collapsedVarsHash = api.utils.collapseObjectToArray(varsHash)
    if (collapsedVarsHash !== false) {
      varsHash = { payload: collapsedVarsHash } // post was an array, lets call it "payload"
    }

    for (const v in varsHash) {
      connection.params[v] = varsHash[v]
    }
  }

  transformHeaders (headersArray) {
    return headersArray.reduce((headers, currentHeader) => {
      const currentHeaderKey = currentHeader[0].toLowerCase()
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

  buildRequesterInformation (connection) {
    const requesterInformation = {
      id: connection.id,
      fingerprint: connection.fingerprint,
      messageId: connection.messageId,
      remoteIP: connection.remoteIP,
      receivedParams: {}
    }

    for (const p in connection.params) {
      if (api.config.general.disableParamScrubbing === true || api.params.postVariables.indexOf(p) >= 0) {
        requesterInformation.receivedParams[p] = connection.params[p]
      }
    }

    return requesterInformation
  }

  cleanHeaders (connection) {
    const originalHeaders = connection.rawConnection.responseHeaders.reverse()
    const foundHeaders = []
    const cleanedHeaders = []
    for (const i in originalHeaders) {
      const key = originalHeaders[i][0]
      const value = originalHeaders[i][1]
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

  cleanSocket (bindIP, port) {
    if (!bindIP && typeof port === 'string' && port.indexOf('/') >= 0) {
      fs.unlink(port, (error) => {
        if (error) {
          this.log(`cannot remove stale socket @ ${port}: ${error}`, 'error')
        } else {
          this.log(`removed stale unix socket @ ${port}`)
        }
      })
    }
  }

  chmodSocket (bindIP, port) {
    if (!bindIP && typeof port === 'string' && port.indexOf('/') >= 0) {
      fs.chmodSync(port, '0777')
    }
  }

  callbackHtmlEscape (str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\)/g, '')
      .replace(/\(/g, '')
  }

  goodbye () {
    // disconnect handlers
  }
}
