exports.status = {
  name: 'status',
  description: 'I will return some basic information about the API',
   
  outputExample:{  
    "id":"192.168.2.11",
    "actionheroVersion":"9.4.1",
    "uptime":10469,
    "stats":{  
      "actionhero:stats":{  
        "actions:actionsCurrentlyProcessing":"0",
        "actions:processedActions:showDocumentation":"1",
        "actions:processedActions:status":"1",
        "actions:totalProcessedActions":"2",
        "connections:activeConnections:web":"0",
        "connections:connections:web":"7",
        "connections:totalActiveConnections":"0",
        "connections:totalConnections":"7",
        "staticFiles:filesSent":"5"
      }
    },
    "queues":{  

    },
    "workers":{  

    },
    "serverInformation":{  
      "serverName":"actionhero API",
      "apiVersion":"0.0.1",
      "requestDuration":12,
      "currentTime":1420953679624
    }
  },

  run: function(api, data, next){
    api.stats.getAll(function(err, stats){
      api.tasks.details(function(err, details){
        data.response.id                = api.id;
        data.response.actionheroVersion = api.actionheroVersion;
        data.response.uptime            = new Date().getTime() - api.bootTime;
        data.response.stats             = stats;
        data.response.queues            = details.queues;
        data.response.workers           = details.workers;
        
        next(err);
      });
    });
  }
};