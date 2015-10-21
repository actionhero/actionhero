var primus              = require('primus');
var UglifyJS            = require('uglify-js');
var fs                  = require('fs');
var path                = require('path');
var util                = require('util');
var browser_fingerprint = require('browser_fingerprint');

var initialize = function(api, options, next){

  //////////
  // INIT //
  //////////

  var type = 'websocket'
  var attributes = {
    canChat:               true,
    logConnections:        true,
    logExits:              true,
    sendWelcomeMessage:    true,
    verbs: [
      'quit',
      'exit',
      'documentation',
      'roomAdd',
      'roomLeave',
      'roomView',
      'detailsView',
      'say'
    ]
  }

  var server = new api.genericServer(type, options, attributes);

  //////////////////////
  // REQUIRED METHODS //
  //////////////////////

  server.start = function(next){
    var webserver = api.servers.servers.web;
    server.server = new primus(webserver.server, api.config.servers.websocket.server);

    server.server.on('connection', function(rawConnection){
      handleConnection(rawConnection);
    });

    server.server.on('disconnection', function(rawConnection){
      handleDisconnection(rawConnection);
    });

    api.log('webSockets bound to ' + webserver.options.bindIP + ':' + webserver.options.port, 'debug');
    server.active = true;

    server.writeClientJS();

    next();
  }

  server.stop = function(next){
    server.active = false;
    if( api.config.servers.websocket.destroyClientsOnShutdown === true ){
      server.connections().forEach(function(connection){
        connection.destroy();
      });
    }
    process.nextTick(function(){
      next();
    });
  }

  server.sendMessage = function(connection, message, messageCount){
    if(message.error){
      message.error = api.config.errors.serializers.servers.websocket(message.error);
    }
    
    if(!message.context){ message.context = 'response'; }
    if(!messageCount){ messageCount = connection.messageCount; }
    if(message.context === 'response' && !message.messageCount){ message.messageCount = messageCount; }
    connection.rawConnection.write(message);
  }

  server.sendFile = function(connection, error, fileStream, mime, length, lastModified){
    var content = '';
    var response = {
      error        : error,
      content      : null,
      mime         : mime,
      length       : length,
      lastModified : lastModified,
    };

    try{
      if(!error){
        fileStream.on('data', function(d){ content+= d; });
        fileStream.on('end', function(){
          response.content = content;
          server.sendMessage(connection, response, connection.messageCount);
        });
      }else{
        server.sendMessage(connection, response, connection.messageCount);
      }
    }catch(e){
      api.log(e, 'warning');
      server.sendMessage(connection, response, connection.messageCount);
    }
  };

  server.goodbye = function(connection){
    connection.rawConnection.end();
  };

  ////////////
  // EVENTS //
  ////////////

  server.on('connection', function(connection){
    connection.rawConnection.on('data', function(data){
      handleData(connection, data);
    });
  });

  server.on('actionComplete', function(data){
    if(data.toRender !== false){
      data.connection.response.messageCount = data.messageCount;
      server.sendMessage(data.connection, data.response, data.messageCount)
    }
  });

  ////////////
  // CLIENT //
  ////////////

  server.compileActionheroClientJS = function(){
    var ahClientSource = fs.readFileSync(__dirname + '/../client/actionheroClient.js').toString();
    var url = api.config.servers.websocket.clientUrl;
    ahClientSource = ahClientSource.replace(/%%URL%%/g, url);
    var defaults = {}
    for(var i in api.config.servers.websocket.client){
      defaults[i] = api.config.servers.websocket.client[i]
    }
    defaults.url = url;
    var defaultsString = util.inspect(defaults);
    defaultsString = defaultsString.replace('\'window.location.origin\'', 'window.location.origin');
    ahClientSource = ahClientSource.replace('%%DEFAULTS%%', 'return ' + defaultsString);

    return ahClientSource;
  }

  server.renderClientJS = function(minimize){
    if(!minimize){ minimize = false; }
    var libSource = api.servers.servers.websocket.server.library();
    var ahClientSource = server.compileActionheroClientJS();
    ahClientSource =
      ';;;\r\n' +
      '(function(exports){ \r\n' +
      ahClientSource +
      '\r\n' +
      'exports.ActionheroClient = ActionheroClient; \r\n' +
      'exports.actionheroClient = actionheroClient; \r\n' +
      '})(typeof exports === \'undefined\' ? window : exports);' ;
    if(minimize){
      return UglifyJS.minify(libSource + '\r\n\r\n\r\n' + ahClientSource, {fromString: true}).code;
    }else{
      return (libSource + '\r\n\r\n\r\n' + ahClientSource);
    }
  }

  server.writeClientJS = function(){
    if(!api.config.general.paths.public || api.config.general.paths.public.length === 0){
      return;
    }
    if(api.config.servers.websocket.clientJsPath && api.config.servers.websocket.clientJsName){
      var base = path.normalize(
        api.config.general.paths.public[0] +
        path.sep +
        api.config.servers.websocket.clientJsPath +
        path.sep +
        api.config.servers.websocket.clientJsName
      );
      try{
        fs.writeFileSync(base + '.js', server.renderClientJS(false));
        api.log('wrote ' + base + '.js', 'debug');
        fs.writeFileSync(base + '.min.js', server.renderClientJS(true));
        api.log('wrote ' + base + '.min.js', 'debug');
      }catch(e){
        api.log('Cannot write client-side JS for websocket server:', 'warning');
        api.log(e, 'warning');
        throw e;
      }
    }
  }

  /////////////
  // HELPERS //
  /////////////

  var handleConnection = function(rawConnection){
    var parsedCookies   = browser_fingerprint.parseCookies(rawConnection);
    var fingerprint     = parsedCookies[api.config.servers.web.fingerprintOptions.cookieKey];
    server.buildConnection({
      rawConnection  : rawConnection,
      remoteAddress  : rawConnection.address.ip,
      remotePort     : rawConnection.address.port,
      fingerprint    : fingerprint,
    });
  }

  var handleDisconnection = function(rawConnection){
    for(var i in server.connections()){
      if(server.connections()[i] && rawConnection.id === server.connections()[i].rawConnection.id){
        server.connections()[i].destroy();
        break;
      }
    }
  }

  var handleData = function(connection, data){
    var verb = data.event;
    delete data.event;
    connection.messageCount++;
    connection.params = {};
    if(verb === 'action'){
      for(var v in data.params){
        connection.params[v] = data.params[v];
      }
      connection.error = null;
      connection.response = {};
      server.processAction(connection);
    } else if(verb === 'file'){
      connection.params = {
        file: data.file
      }
      server.processFile(connection);
    } else {
      var words = [];
      var message;
      if(data.room){
        words.push(data.room);
        delete data.room;
      }
      for(var i in data){ words.push(data[i]); }
      connection.verbs(verb, words, function(error, data){
        if(!error){
          message = {status: 'OK', context: 'response', data: data};
          server.sendMessage(connection, message);
        } else {
          message = {status: error, context: 'response', data: data}
          server.sendMessage(connection, message);
        }
      });
    }
  }

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.initialize = initialize;
