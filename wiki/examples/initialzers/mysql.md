---
layout: wiki
title: Wiki - Example mysql Initializer
---

# Example mysql Initializer

Using the [Sequelize](http://sequelizejs.com/) ORM.

## Initializer

{% highlight javascript %}
var Sequelize = require("sequelize");
var SequelizeFixtures = require('sequelize-fixtures');

exports.mySQL = function(api, next){
  
  api.mySQL = {
    _start: function(api, next){
      var self = this;

      api.mySQL.sequelize = new Sequelize(api.config.mySQL.database, null, null, api.config.mySQL);

      api.models = {
        user: api.mySQL.sequelize.import(__dirname + "/../models/user.js"),
        slug: api.mySQL.sequelize.import(__dirname + "/../models/slug.js"),
        // ...
      }
      
      if(api.env === "test"){  
        SequelizeFixtures.loadFile(__dirname + '/../test/fixtures/*.json', api.models, function(){
          self.test(next);
        });
      }else{
        self.test(next);
      }
    },

    _teardown: function(api, next){
      next();
    },

    test: function(next){
      api.models.user.count().success(function(count){
        api.log("Connected to DB and coutned " + count + " users.")
        next();
      }).error(function(e){
        api.log(e, 'warning');
        process.exit();
      });
    }
  }

  next();
}
{% endhighlight %}

## An example Model
living in /models/user.js
{% highlight javascript %}
module.exports = function(sequelize, DataTypes) {
  return sequelize.define("user", {
    email:         DataTypes.STRING,
    first_name:    DataTypes.STRING,
    last_name:     DataTypes.STRING,
    password_hash: DataTypes.STRING,
    password_salt: DataTypes.STRING,
    admin: DataTypes.BOOLEAN,
  }, {
    timestamps:  true
  })
}
{% endhighlight %}

## Config 
Extra settings to add to `config.js`
{% highlight javascript %}
config.mySQL = {
  "database"    : "v3_development",
  "dialect"     : "mysql",
  "port"        : 3306,
  "pool"        : {
    "maxConnections" : 20,
    "maxIdleTime"    : 30000
  },
  "replication" : {
    "write": {
      "host"     : "127.0.0.1", 
      "username" : "root", 
      "password" : "",
      "pool"     : {}
    },
    "read": [
      {
        "host"     : "127.0.0.1", 
        "username" : "root", 
        "password" : "",
        "pool"     : {}
      }
    ]
  }
}
{% endhighlight %}