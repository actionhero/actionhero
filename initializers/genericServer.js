var genericServer = function(api, next){
  // I am the prototypical generic server that all other types of servers inherit from.
  // I shouldn't actually be used by a client
  // Note the methods in this template server, as they are all required for "real" servers

  ////////////////////
  // COMMON METHODS //
  ////////////////////

  // options are meant to be configrable in `config.js`
  // attributes are descrptions of the server and cannot be changed at implamentation: IE: 'canChat'
  api.genericServer = function(name, options, attributes){
    this.type = name;
    this.options = options;
    this.attributes = attributes;
  }

  var methodNotDefined = function(){
    throw new Error('The containing method should be defined for this server type');
  }

  ///////////////////////////////////////
  // METHODS WHICH MUST BE OVERWRITTEN //
  ///////////////////////////////////////

  // I am invoked as part of shutdown
  api.genericServer.prototype._teardown = function(api, next){ methodNotDefined(); }

  // I generate new client's unique fingerprint
  api.genericServer.prototype.buildClientFingerprint = function(connection){ methodNotDefined(); }

  // This method will be appended to the connection as `connection.sendMessage`
  api.genericServer.prototype.sendClientMessage = function(message){ methodNotDefined(); }

  // I am used to append information to a client of this type
  api.genericServer.prototype.decorateConnection = function(connection, options){ methodNotDefined(); }

  next();

});


exports.genericServer = genericServer;