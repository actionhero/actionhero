exports.status = {
  name: 'status',
  description: 'I will return some basic information about the API',

  outputExample:{
    'id':'192.168.2.11',
    'actionheroVersion':'9.4.1',
    'uptime':10469
  },

  run: function(api, data, next){
    data.response.id                = api.id;
    data.response.actionheroVersion = api.actionheroVersion;
    data.response.uptime            = new Date().getTime() - api.bootTime;

    next();
  }
};
