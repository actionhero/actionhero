var primus   = require('primus');
var UglifyJS = require('uglify-js');
var fs       = require('fs');
var path     = require('path');
var util     = require('util');

var websocket = function(api, options, next){

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

  server._start = function(next){
    var webserver = api.servers.servers['web'];
    server.server = new primus(webserver.server, api.config.servers.websocket.server);

    server.server.on('connection', function(rawConnection){
      handleConnection(rawConnection);
    });

    server.server.on('disconnection', function(rawConnection){
      handleDisconnection(rawConnection);
    });

    api.log('webSockets bound to ' + webserver.options.bindIP + ':' + webserver.options.port + ' mounted at ' + api.config.servers.websocket.pathname, 'notice');
    server.active = true;

    server.writeClientJS();

    next();
  }

  server._stop = function(next){
    server.active = false;
    server.connections().forEach(function(connection){
      connection.destroy();
    });
    process.nextTick(function(){
      next();
    });
  }

  server.sendMessage = function(connection, message, messageCount){
    if(message.context == null){ message.context = 'response'; }
    if(messageCount == null){ messageCount = connection.messageCount; }
    if(message.context === 'response' && message.messageCount == null){ message.messageCount = messageCount; }
    connection.rawConnection.write(message);
  }

  server.sendFile = function(connection, error, fileStream, mime, length){
    var content = '';
    var response = {
      error      : error,
      content    : null,
      mime       : mime,
      length     : length
    };

    try{ 
      if(error == null){
        fileStream.on('data', function(d){ content+= d; });
        fileStream.on('end', function(d){
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

  server.goodbye = function(connection, reason){
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

  server.on('actionComplete', function(connection, toRender, messageCount){
    if(toRender != false){
      connection.response.messageCount = messageCount;
      server.sendMessage(connection, connection.response, messageCount)
    }
  });

  ////////////
  // CLIENT //
  ////////////

  server.compileActionheroClientJS = function(){
    var ahClientSource = fs.readFileSync(__dirname + '/../client/actionheroClient.js').toString();
    ahClientSource = ahClientSource.replace('%%DEFAULTS%%', 'return ' + util.inspect(api.config.servers.websocket.client));
    var url = api.config.servers.websocket.clientUrl;
    if(url.indexOf('/') < 0 || url.indexOf('http://') == 0 || url.indexOf('https://') == 0){
      url = "'" + url + "'";
    }
    ahClientSource = ahClientSource.replace('%%URL%%', url);

    return ahClientSource;
  }

  server.renderClientJS = function(minimize){
    if(minimize == null){ minimize = false; }
    var libSource = api.servers.servers.websocket.server.library();
    var ahClientSource = server.compileActionheroClientJS();
    ahClientSource = '(function(exports){ \r\n' 
      + ahClientSource
      + '\r\n'
      + 'exports.actionheroClient = actionheroClient; \r\n'
      + '})(typeof exports === \'undefined\' ? window : exports);' ;
    if(minimize){
      return UglifyJS.minify(libSource + '\r\n\r\n\r\n' + ahClientSource, {fromString: true}).code;
    }else{
      return (libSource + '\r\n\r\n\r\n' + ahClientSource);
    }    
  }

  server.writeClientJS = function(){
    if(api.config.servers.websocket.clientJsPath != null && api.config.servers.websocket.clientJsName != null){
      var base = path.normalize(
        api.config.general.paths.public + 
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
    server.buildConnection({
      rawConnection  : rawConnection,
      remoteAddress  : rawConnection.address.ip,
      remotePort     : rawConnection.address.port
    });
  }

  var handleDisconnection = function(rawConnection){
    for(var i in server.connections()){
      if(server.connections()[i] != null && rawConnection.id === server.connections()[i].rawConnection.id){
        server.connections()[i].destroy();
        break;
      }
    }
  }

  var handleData = function(connection, data){
    var verb = data.event;
    delete data.event;
    connection.messageCount++;
    if(verb == 'action'){
      for(var v in data.params){
        connection.params[v] = data.params[v];
      };
      connection.error = null;
      connection.response = {};
      server.processAction(connection);
    } else if(verb == 'file'){
      connection.params = {
        file: data.file
      }
      server.processFile(connection);
    } else {
      var words = []
      for(var i in data){ words.push(data[i]); }
      connection.verbs(verb, words, function(error, data){
        if(error == null){
          var message = {status: 'OK', context: 'response', data: data};
          server.sendMessage(connection, message);
        } else {
          var message = {status: error, context: 'response', data: data}
          server.sendMessage(connection, message);
        }
      });
    }
  }

  next(server);
}

/////////////////////////////////////////////////////////////////////
// exports
exports.websocket = websocket;
