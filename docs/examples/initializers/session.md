---
layout: docs
title: Documentation - Example Session Initializer
---

# Example Session Initializer

{% highlight javascript %}

////////////////////////////////////////////////////////////////////////////
// Sessions

module.exports = {
  initialize: function(api, next){

    api.session = {
      prefix: "__session",
      sessionExipreTime: 1000 * 60 * 60 // 1 hour
    };

    api.session.fingerprint = function(connection){
      if(connection.fingerprint != null){
        return connection.fingerprint;
      }else{
        return conneciton.id;
      }
    }

    api.session.save = function(connection, next){
      var key = api.session.prefix + "-" + api.session.fingerprint(connection);
      var value = connection.session;
      api.cache.save(key, value, api.session.sessionExipreTime, function(err, didSave){
        api.cache.load(key, function(err, savedVal){
          // console.log(savedVal);
          if(typeof next == "function"){ next(err, savedVal); };
        });
      });
    }

    api.session.load = function(connection, next){
      var key = api.session.prefix + "-" + api.session.fingerprint(connection);
      api.cache.load(key, function(err, value){
        connection.session = value;
        next(err, value);
      });
    }

    next();
  }
}
{% endhighlight %}
