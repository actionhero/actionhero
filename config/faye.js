exports.default = {
  faye: function(api){
    return {
      // faye's URL mountpoint.  Be sure to not overlap with an action or route
      mount: '/faye',
      // idle timeout for clients
      timeout: 45,
      // should clients ping the server?
      ping: null,
      // What redis server should we connect to for faye?
      redis: api.config.redis,
      // redis prefix for faye keys
      namespace: 'faye:'
    }
  }
}

exports.test = {
  faye: function(api){
    return {
      mount: '/faye',
      timeout: 45,
      ping: null,
      redis: api.config.redis,
      namespace: 'faye:'
    }
  }
}