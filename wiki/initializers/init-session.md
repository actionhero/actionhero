```javascript

	////////////////////////////////////////////////////////////////////////////
	// Sessions 
	
	exports.sessions(api, next){
	
	  api.session = {
	    prefix: "__session",
	    sessionExipreTime: 1000 * 60 * 60 // 1 hour
	  };
	
	  api.session.save = function(connection, next){
	    var key = api.session.prefix + "-" + connection.id;
	    var value = connection.session;
	    api.cache.save(key, value, api.session.sessionExipreTime, function(err, didSave){
	      api.cache.load(key, function(err, savedVal){
	        // console.log(savedVal);
	        if(typeof next == "function"){ next(err, savedVal); };
	      });
	    });
	  }
	
	  api.session.load = function(connection, next){
	    var key = api.session.prefix + "-" + connection.id;
	    api.cache.load(key, function(err, value){
	      connection.session = value;
	      next(err, value);
	    });
	  }
	
	  next();
	}
		
```