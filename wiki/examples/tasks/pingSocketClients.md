---
layout: wiki
title: Wiki - Example pingSocketClients Task
---

# Example pingSocketClients Task

{% highlight javascript %}

exports.task = {
  name:          'pingSocketClients',
  description:   'I will send a message to all connected socket clients.  This will help with TCP keep-alive and send the current server time',
  frequency:     5 * 1000,
  queue:         'default',
  plugins:       [],
  pluginOptions: {},
  
  run: function(api, params, next){
    for(var i in api.connections.connections){
      var connection = api.connections.connections[i];
      if(connection.type == 'socket'){
        var message = {};
        message.context = "api";
        message.status = "keep-alive";
        message.serverTime = new Date();
 
        connection.sendMessage(message)
      }
    }
      
    next(true, null);
  }
};

{% endhighlight %}