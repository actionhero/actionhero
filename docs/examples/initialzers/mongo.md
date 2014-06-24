---
layout: docs
title: Documentation - Example Mongo Initializer
---

# Example Mongo Initializer

{% highlight javascript %}

var mongoPackage = require('mongodb');
var async = require('async');

var mongo = function (api, next) {

    api.mongo = {};
    api.mongo.connector = {};
    api.mongo.client = {};
    api.mongo.Server = mongoPackage.Server;
    api.mongo.Db = mongoPackage.Db;
    api.mongo.ObjectID = mongoPackage.ObjectID;
    api.mongo.Collection = mongoPackage.Collection;
    api.mongo.enable = api.configData.mongo.enable;
    if (api.configData.mongo.enable == true) {
        async.each(api.configData.countries, function (item, callback) {
            api.log("Enabling mongoDB connection for country: " + item, "debug");
            api.mongo.connector[item] = new api.mongo.Db(item, new api.mongo.Server(api.configData.mongo.host, api.configData.mongo.port, {auto_reconnect:true}), {safe:false});
            api.mongo.connector[item].open(function (err, db) {
                api.mongo.client[item] = db;
                callback();
            });
        }, function (err) {
            next();
        });
        api.mongo._teardown = function (api, next) {
            async.each(api.configData.countries, function (item, callback) {
                api.log("Releasing mongoDB connection for country: " + item, "debug");
                api.mongo.client[item].close();
                callback();
            }, function (err) {
                next();
            });
        }
    } else {
        api.log("Running without MongoDB", "notice");
        next();
    }
}

/////////////////////////////////////////////////////////////////////
// exports
exports.mongo = mongo;

{% endhighlight %}
