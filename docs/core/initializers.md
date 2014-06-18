---
layout: docs
title: Documentation - Initializers
---

# Initializers

Initializers are run before your server boots.  Here is where you include any new modules or add custom code which you want to be available to all the rest of your actionhero server.

Custom Initializers to your project will always be loaded after core actionhero initializers.  This means you can modify existing actionhero methods on in the `api` object if you wish.

## Format

To use a custom initializer, create a `initializers` directory in your project.  Ensure that the file name matches the export, IE:

**initStuff.js**

{% highlight javascript %}
exports.stuff = function(api, next){
	  
  api.stuff = {}; // now api.stuff is globally available to my project
  api.stuff.magicNumber = 1234;

  next();
}
{% endhighlight %}

You can generate a file of this type with `actionhero generateInitializer --name=stuff`

## initializer._start()

If you have something you need to do at server boot (rather than at load time), you can define a `_start(api, next)` method in your object which will be called just before the server boots.

For Example:

{% highlight javascript %}
exports.stuff = function(api, next){
	  
  api.stuff = {
    _start: function(api, next){ api.log('hi', 'bold'); next(); }
  };

  next();
}
{% endhighlight %}

## initializer._stop()

If you append an object to `api` (for example `api.stuff`), you can optionally add a `_stop` method to it which will be called when the server is restarted or shutdown.  actionhero uses this internally to turn off the servers and handle pid files, but there are many uses.

`api.{namespace}._stop = function(api, next)`

For Example:

{% highlight javascript %}
exports.stuff = function(api, next){
	  
  api.stuff = {
    magicNumber: 1234,
    _stop: function(api, next){ api.stuff.magicNumber = null; next(); }
  };

  next();
}
{% endhighlight %}