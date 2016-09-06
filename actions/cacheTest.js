exports.cacheTest = {
  name: 'cacheTest',
  description: 'I will test the internal cache functions of the API',

  outputExample: {
    cacheTestResults: {
      saveResp: true,
      sizeResp: 1,
      loadResp: {
        key: 'cacheTest_key',
        value: 'value',
        expireTimestamp: 1420953274716,
        createdAt: 1420953269716,
        readAt: null
      },
      deleteResp: true
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
        if(s.length < 3){ return '`value` should be at least 3 letters long'; }
        else{ return true; }
      }
    },
  },

  run: function(api, data, next){
    var key = 'cacheTest_' + data.params.key;
    var value = data.params.value;

    data.response.cacheTestResults = {};

    api.cache.save(key, value, 5000, function(error, resp){
      data.response.cacheTestResults.saveResp = resp;
      api.cache.size(function(error, numberOfCacheObjects){
        data.response.cacheTestResults.sizeResp = numberOfCacheObjects;
        api.cache.load(key, function(error, resp, expireTimestamp, createdAt, readAt){
          data.response.cacheTestResults.loadResp = {
            key: key,
            value: resp,
            expireTimestamp: expireTimestamp,
            createdAt: createdAt,
            readAt: readAt
          };
          api.cache.destroy(key, function(error, resp){
            data.response.cacheTestResults.deleteResp = resp;
            next(error);
          });
        });
      });
    });
  }

};
