---
layout: docs
title: Documentation - Example mysql Initializer
---

# Example mysql Initializer

Using the [Sequelize](http://sequelizejs.com/) ORM.

## Initializer

{% highlight javascript %}
var Sequelize = require("sequelize");
var SequelizeFixtures = require('sequelize-fixtures');

module.exports = {
  start: function(api, next){
    api.mySQL.sequelize = new Sequelize(api.config.mySQL.database, null, null, api.config.mySQL);

    api.models = {
      user: api.mySQL.sequelize.import(__dirname + "/../models/user.js"),
      slug: api.mySQL.sequelize.import(__dirname + "/../models/slug.js"),
      // ...
    }

    next();
  },
  
  stop: {
    api.mySQL.sequelize.disconnect(function(){
      next();
    });
  },
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
Extra settings to add to `config/mysql.js`
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
