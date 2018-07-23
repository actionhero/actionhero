var ActionheroWebsocketClient = function (options, client) {
  var self = this

  self.callbacks = {}
  self.id = null
  self.events = {}
  self.rooms = []
  self.state = 'disconnected'

  self.options = self.defaults()
  for (var i in options) {
    self.options[i] = options[i]
  }

  if (client) {
    self.externalClient = true
    self.client = client
  }
}

if (typeof Primus === 'undefined') {
  var util = require('util')
  var EventEmitter = require('events').EventEmitter
  util.inherits(ActionheroWebsocketClient, EventEmitter)
} else {
  ActionheroWebsocketClient.prototype = new Primus.EventEmitter()
}

ActionheroWebsocketClient.prototype.defaults = function () {
  %%DEFAULTS%%
}

// //////////////
// CONNECTION //
// //////////////

ActionheroWebsocketClient.prototype.connect = function (callback) {
  var self = this
  self.messageId = self.messageId || 0

  if (self.client && self.externalClient !== true) {
    self.client.end()
    self.client.removeAllListeners()
    delete self.client
    self.client = Primus.connect(self.urlWithSession(), self.options)
  } else if (self.client && self.externalClient === true) {
    self.client.end()
    self.client.open()
  } else {
    self.client = Primus.connect(self.urlWithSession(), self.options)
  }

  self.client.once('open', function () {
    self.configure(function (details) {
      self.state = 'connected'
      self.emit('connected')
      if (typeof callback === 'function') { callback(null, details) }
    })
  })

  self.client.on('error', function (error) {
    self.emit('error', error)
  })

  self.client.on('reconnect', function () {
    self.emit('reconnect')
  })

  self.client.on('reconnecting', function () {
    self.emit('reconnecting')
    self.state = 'reconnecting'
    self.emit('disconnected')
  })

  self.client.on('timeout', function () {
    self.state = 'timeout'
    self.emit('timeout')
  })

  self.client.on('close', function () {
    if (self.state !== 'disconnected') {
      self.state = 'disconnected'
      self.emit('disconnected')
    }
  })

  self.client.on('end', function () {
    if (self.state !== 'disconnected') {
      self.state = 'disconnected'
      self.emit('disconnected')
    }
  })

  self.client.on('data', function (data) {
    self.handleMessage(data)
  })
}

ActionheroWebsocketClient.prototype.urlWithSession = function () {
  var self = this
  var url = self.options.url
  if (self.options.cookieKey && self.options.cookieKey.length > 0) {
    var cookieValue = self.getCookie(self.options.cookieKey)
    if (cookieValue && cookieValue.length > 0 ) { url += '?' + self.options.cookieKey + '=' + cookieValue }
  }

  return url
}

ActionheroWebsocketClient.prototype.getCookie = function (name) {
  if (typeof document === 'undefined' || !document.cookie) { return }
  var match = document.cookie.match(new RegExp(name + '=([^;]+)'))
  if (match) return match[1]
}

ActionheroWebsocketClient.prototype.configure = function (callback) {
  var self = this

  self.rooms.forEach(function (room) {
    self.send({event: 'roomAdd', room: room})
  })

  self.detailsView(function (details) {
    self.id = details.data.id
    self.fingerprint = details.data.fingerprint
    self.rooms = details.data.rooms
    return callback(details)
  })
}

// /////////////
// MESSAGING //
// /////////////

ActionheroWebsocketClient.prototype.send = function (args, callback) {
  // primus will buffer messages when not connected
  var self = this
  self.messageId++
  args.messageId = args.params
    ? (args.params.messageId || args.messageId || self.messageId )
    : ( args.messageId || self.messageId )
  if (typeof callback === 'function') { self.callbacks[args.messageId] = callback }
  self.client.write(args)
}

ActionheroWebsocketClient.prototype.handleMessage = function (message) {
  var self = this
  self.emit('message', message)
  var messageId = message.messageId

  if (message.context === 'response') {
    if (typeof self.callbacks[messageId] === 'function') {
      self.callbacks[messageId](message)
    }
    delete self.callbacks[messageId]
  } else if (message.context === 'user') {
    self.emit('say', message)
  } else if (message.context === 'alert') {
    self.emit('alert', message)
  } else if (message.welcome && message.context === 'api') {
    self.welcomeMessage = message.welcome
    self.emit('welcome', message)
  } else if (message.context === 'api') {
    self.emit('api', message)
  }
}

// ///////////
// ACTIONS //
// ///////////

ActionheroWebsocketClient.prototype.action = function (action, params, callback) {
  if (!callback && typeof params === 'function') {
    callback = params
    params = null
  }
  if (!params) { params = {} }
  params.action = action

  if (this.state !== 'connected') {
    this.actionWeb(params, callback)
  } else {
    this.actionWebSocket(params, callback)
  }
}

ActionheroWebsocketClient.prototype.actionWeb = function (params, callback) {
  var xmlhttp = new XMLHttpRequest()
  xmlhttp.onreadystatechange = function () {
    var response
    if (xmlhttp.readyState === 4) {
      if (xmlhttp.status === 200) {
        response = JSON.parse(xmlhttp.responseText)
      } else {
        try {
          response = JSON.parse(xmlhttp.responseText)
        } catch (e) {
          response = { error: {statusText: xmlhttp.statusText, responseText: xmlhttp.responseText} }
        }
      }
      callback(response)
    }
  }

  var method = (params.httpMethod || 'POST').toUpperCase()
  var url = this.options.url + this.options.apiPath + '?action=' + params.action

  if (method === 'GET') {
    for (var param in params) {
      if (~['action', 'httpMethod'].indexOf(param)) continue
      url += '&' + param + '=' + params[param]
    }
  }

  xmlhttp.open(method, url, true)
  xmlhttp.setRequestHeader('Content-Type', 'application/json')
  xmlhttp.send(JSON.stringify(params))
}

ActionheroWebsocketClient.prototype.actionWebSocket = function (params, callback) {
  this.send({event: 'action', params: params}, callback)
}

// ////////////
// COMMANDS //
// ////////////

ActionheroWebsocketClient.prototype.say = function (room, message, callback) {
  this.send({event: 'say', room: room, message: message}, callback)
}

ActionheroWebsocketClient.prototype.file = function (file, callback) {
  this.send({event: 'file', file: file}, callback)
}

ActionheroWebsocketClient.prototype.detailsView = function (callback) {
  this.send({event: 'detailsView'}, callback)
}

ActionheroWebsocketClient.prototype.roomView = function (room, callback) {
  this.send({event: 'roomView', room: room}, callback)
}

ActionheroWebsocketClient.prototype.roomAdd = function (room, callback) {
  var self = this
  self.send({event: 'roomAdd', room: room}, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') { callback(data) }
    })
  })
}

ActionheroWebsocketClient.prototype.roomLeave = function (room, callback) {
  var self = this
  var index = self.rooms.indexOf(room)
  if (index > -1) { self.rooms.splice(index, 1) }
  this.send({event: 'roomLeave', room: room}, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') { callback(data) }
    })
  })
}

ActionheroWebsocketClient.prototype.documentation = function (callback) {
  this.send({event: 'documentation'}, callback)
}

ActionheroWebsocketClient.prototype.disconnect = function () {
  this.state = 'disconnected'
  this.client.end()
  this.emit('disconnected')
}

// depricated lowercase name
var ActionheroWebsocketClient = ActionheroWebsocketClient;
ActionheroWebsocketClient;
