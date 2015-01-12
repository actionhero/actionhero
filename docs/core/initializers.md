---
layout: docs
title: Documentation - Initializers
---

# Initializers

Initializers are the main way you expand your actionhero server.  This is where you connect to databases, modify the global `api` object with new classes and helper methods, and set up your [middleware](/docs/core/middleware.html).

Initializers run in 3 phases coenciding with the lifecytles of the application: `init`. `start`, and `stop`.  All "init" steps happen before all "start" steps.  Initializers can define both methods and priorities which will happen at each phase of the server's lifecycle:

System initilizers (like setting up redis and the cache) have prioirty levels in the 100 to 1000 level range.  Application initilizers should run with a priority level of over 1000 to use methods created by the system.

In general, `initialize()` methods should create prototypes and new object, and `start()` should boot things or connect to external resources.

## Format

To use a custom initializer, create a `initializers` directory in your project.  Ensure that the file name matches the export, IE:

{% highlight javascript %}
module.exports = {
  loadPriority:  1000,
  startPriority: 1000,
  stopPriority:  1000,
  initialize: function(api, next){
    api.myObject = {};

    next();
  },
  start: function(api, next){
    // connect to server
    next();
  },
  stop: function(api, next){
    // disconnect from server
    next();
  }
}
{% endhighlight %}

You can generate a file of this type with `actionhero generateInitializer --name=stuffInit`