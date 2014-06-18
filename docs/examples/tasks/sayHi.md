---
layout: docs
title: Documentation - Example sayHi Task
---

# Example sayHi Task

{% highlight javascript %}

exports.task = {
  name:          'sayHi',
  description:   'I will log to the console every so often',
  frequency:     5 * 1000,
  queue:         'default',
  plugins:       [],
  pluginOptions: {},
  
  run: function(api, params, next){
    api.log("Hello!", "alert");      
    next(true, null);
  }
};

{% endhighlight %}