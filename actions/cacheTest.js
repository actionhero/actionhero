exports.cacheTest = {
  name: 'cacheTest',
  description: 'I will test the internal cache functions of the API',

  outputExample: {
    "cacheTestResults": {
      "saveResp": true,
      "sizeResp": 1,
      "loadResp": {
        "key": "cacheTest_key",
        "value": "value",
        "expireTimestamp": 1420953274716,
        "createdAt": 1420953269716,
        "readAt": null
      },
      "deleteResp": true
    }
  },

  inputs: {
    key: { 
      required: true,
      formatter: function(s){ return String(s); }
    },
    value: { 
      required: true,
      formatter: function(s){ return String(s); },
      validator: function(s){
        if(s.length < 3){ return '`value` should be at least 3 letters long' } 
        else{ return true; }
      }
    },
  },

  run: function(api, connection, next){
    var key = 'cacheTest_' + connection.params.key;
    var value = connection.params.value;

    connection.response.cacheTestResults = {};

    api.cache.save(key, value, 5000, function(err, resp){
      connection.response.cacheTestResults.saveResp = resp;
      api.cache.size(function(err, numberOfCacheObjects){
        connection.response.cacheTestResults.sizeResp = numberOfCacheObjects;
        api.cache.load(key, function(err, resp, expireTimestamp, createdAt, readAt){
          connection.response.cacheTestResults.loadResp = {
            key: key,
            value: resp,
            expireTimestamp: expireTimestamp,
            createdAt: createdAt,
            readAt: readAt
          };
          api.cache.destroy(key, function(err, resp){
            connection.response.cacheTestResults.deleteResp = resp;
            next(connection, true);
          });
        });
      });
    });
  }

};