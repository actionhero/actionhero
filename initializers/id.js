var cluster = require('cluster');
var argv = require('optimist').argv;

var id = function(api, next){

  if(null !== argv['title']){
    api.id = argv['title'];
  } else if(null !== process.env['ACTIONHERO_TITLE']){
    api.id = process.env['ACTIONHERO_TITLE'];
  } else if(null === api.config.general.id){
    var externalIP = api.utils.getExternalIPAddress();
    if(false === externalIP){
      var message = ' * Error fetching this hosts external IP address; setting id base to \'actionHero\''
      try {
        api.log(message, 'crit');
      } catch(e){
        console.log(message);
      }
      externalIP = 'actionHero';
    }

    api.id = externalIP;
    if(cluster.isWorker){ api.id += ':' + process.pid }
  } else {
    api.id = api.config.general.id;
  }
  
  next();
}

/////////////////////////////////////////////////////////////////////
// exports
exports.id = id;
