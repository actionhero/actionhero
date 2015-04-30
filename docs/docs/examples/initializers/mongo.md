---
layout: docs
title: Documentation - Example Mongo Initializer
---

# Example Mongo Initializer

{% highlight javascript %}

var mongoPackage = require('mongodb');

var mongo = function (api, next) {

    api.mongo = {};
    api.mongo.client = {};
    api.mongo.enable = api.config.mongo.enable;
    api.mongo.client = mongoPackage.MongoClient;

    api.log("configuring MongoDB "+api.config.mongo.enable, "notice");

    if (api.config.mongo.enable == true) {

        var url = 'mongodb://'+api.config.mongo.host+':'+api.config.mongo.port+'/'+api.config.mongo.db;

        api.mongo.client.connect(url, function(err, db) {
            if(err) {
                api.log(err+"error in mongoDB connection", "notice");
                next();
                } else {

                    api.log("mongoDB connection ok ", "notice");
                    api.mongo.db = db;
                    next();
                }
        });
    }
}
/////////////////////////////////////////////////////////////////////
// exports
exports.mongo = mongo;

{% endhighlight %}

And this type of initializer would require a file to be created in `./config/mongo.js`:

{% highlight javascript %}

exports.default = { 
  mongo: function(api){
    return {
        enable: true,
        host: '1.2.3.4'
        port: 27017
        db: 'myDatabase'
    }
  }
}

{% endhighlight %}