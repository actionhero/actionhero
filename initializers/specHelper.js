var specHelper = function(api, next){

  if(api.env === 'test' || process.env.SPECHELPER === 'true' || process.env.SPECHELPER === true){

    api.specHelper = {};

    api.specHelper._start = function(api, next){
      new api.specHelper.testServer(api, {}, function(serverObject){
        api.servers.servers.testServer = serverObject;
        api.servers.servers.testServer._start(function(){
          next();
        });
      });
    }

    // create a test 'server' to run actions
    api.specHelper.testServer = function(api, options, next){
      var type = 'testServer'
      var attributes = {
        canChat: true,
        logConnections: false,
        logExits: false,
        sendWelcomeMessage: true,
        verbs: api.connections.allowedVerbs,
      }

      var server = new api.genericServer(type, options, attributes);

      server._start = function(next){
        api.log('loading the testServer', 'warning');
        next();
      }

      server._stop = function(next){
        next();
      }

      server.sendMessage = function(connection, message, messageCount){
        process.nextTick(function(){
          message.messageCount = messageCount;
          connection.messages.push(message);
          if(typeof connection.actionCallbacks[messageCount] === 'function'){
            connection.actionCallbacks[messageCount](message, connection);
            delete connection.actionCallbacks[messageCount];
          }
        });
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
        //
      };

      server.on('connection', function(connection){
        connection.messages = [];
        connection.actionCallbacks = {};
      });

      server.on('actionComplete', function(connection, toRender, messageCount){
        connection.response.messageCount = messageCount;
        connection.response.serverInformation = {
          serverName:      api.config.general.serverName,
          apiVersion:      api.config.general.apiVersion,
        };
        connection.response.requesterInformation = {
          id: connection.id,
          remoteIP: connection.remoteIP,
          receivedParams: {}
        };
        for(var k in connection.params){
          connection.response.requesterInformation.receivedParams[k] = connection.params[k];
        }
        if(toRender === true){
          server.sendMessage(connection, connection.response, messageCount);
        }
      });

      next(server);
    }

    api.specHelper.connection = function(){
      var id = api.utils.randomString(32);
      api.servers.servers.testServer.buildConnection({
        id             : id,
        rawConnection  : {},
        remoteAddress  : 'testServer',
        remotePort     : 0
      });

      return api.connections.connections[id];
    }

    // create helpers to run an action
    // data can be a params hash or a connection
    api.specHelper.runAction = function(actionName, input, next){
      var connection;
      if(typeof input === 'function' && next == null){
        next = input;
        input = {};
      }
      if(input.id != null && input.type === 'testServer'){
        connection = input;
      }else{
        connection = new api.specHelper.connection();
        connection.params = input;
      }
      connection.params.action = actionName;

      connection.messageCount++;
      if(typeof next === 'function'){
        connection.actionCallbacks[(connection.messageCount)] = next;
      }

      process.nextTick(function(){
        api.servers.servers.testServer.processAction(connection);
      });
    }

    // helpers to get files
    api.specHelper.getStaticFile = function(file, next){
      var connection = new api.specHelper.connection();
      connection.params.file = file;

      connection.messageCount++;
      if(typeof next === 'function'){
        connection.actionCallbacks[(connection.messageCount)] = next;
      }

      api.servers.servers.testServer.processFile(connection);
    }

    // create helpers to run a task
    api.specHelper.runTask = function(taskName, params, next){
      api.tasks.tasks[taskName].run(api, params, next);
    }

    next();
  }else{
    next();
  }
  
}

/////////////////////////////////////////////////////////////////////
// exports
exports.specHelper = specHelper;
