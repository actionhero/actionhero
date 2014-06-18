---
layout: docs
title: Documentation - Example cleanLogFiles Task
---

# Example cleanLogFiles Task

{% highlight javascript %}

var fs = require('fs');
var maxLogFileSize = '100000';
 
exports.task = {
  name:          'cleanLogFiles',
  description:   'I will clean (delete) all log files if they get to big',
  frequency:     60 * 60 * 1000,
  queue:         'default',
  plugins:       [],
  pluginOptions: {},
  
  run: function(api, params, next){
    fs.readdirSync(api.config.paths.log).forEach( function(file){
      file = api.config.log.logFolder + "/" + file;
      fs.exists(file, function (exists){
        if(exists){
          size = fs.statSync(file).size;
          if(size >= maxLogFileSize)
          {
            api.log(file + " is larger than " + maxLogFileSize + " bytes.  Deleting.", "yellow");
            fs.unlinkSync(file);
          }
        }
      });
    });
    
    next(true, null);
  }
};

{% endhighlight %}