---
layout: docs
title: Documentation - Exceptions
---

# Exceptions

**This module only works for node.js >= `v0.8.0`, as it makes use of [domains](http://nodejs.org/api/domain.html)**

## General

actionhero will catch any uncaught exceptions which take place within actions or tasks.  These exceptions will be logged along with any relevant details which can be captured about the connection making the request.

When this happens:

- clients will be sent `connection.error` as defined in `api.config.general.serverErrorMessage`
  - Web clients will also be sent the 500 (server error) header 
- Exceptions created in tasks will also be logged, and the task will return its callback
  - If the Exception occurred within a periodic task, the task will not be re-enqueued.

Keep in mind that any application-wide settings which may have been modified in this erroneous action/task will **not** be rolled-back

Other exceptions, perhaps occurring in an initializer, will not be caught.  These are probably serious and should be investigated, and are allowed to crash the server.

## Custom Error Reporters

`api.exceptionHandlers.reporters` is an array that contains all the error reporters.  Upon an uncaught exception from an error or task, all the reporters in the array will be invoked with `(err, type, name, objects, severity)`.  You can remove the default `stdout` reporter by setting `api.exceptionHandlers.reporters = [];`


So, say you wanted to send yourself an email when an error occured:

{% highlight javascript %}
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'gmail.user@gmail.com',
        pass: 'userpass'
    }
});

var emailErrorReporter = function(err, type, name, objects, severity){
  var lines = [];
  lines.push('! Error: ' + err.message + ' @ ' + severity);
  lines.push('!     When: ' + new Date().getTime());
  lines.push('!     Env: '  + api.env);
  lines.push('!     Type: ' + type);
  lines.push('!     Name: ' + name);
  lines.push('!     Data: ' + JSON.stringify(objects));

  var mailOptions = {
    from: 'actionhero@actionhero.com',
    to: 'you@site.com',
    subject: 'actionhero error!',
    text: lines.join("\r\n")
  };

  transporter.sendMail(mailOptions);
}


api.exceptionHandlers.reporters.push(emailErrorReporter);
{% endhighlight %}

As an example, here is the default `stdout` logger:

{% highlight javascript %}
var consoleReporter = function(err, type, name, objects, severity){
    var extraMessages = [];
    
    if(type === 'loader'){
      extraMessages.push('! Failed to load ' + objects.fullFilePath)
    }

    else if(type === 'action'){
      extraMessages.push('! uncaught error from action: ' + name);
      extraMessages.push('! connection details:');
      var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
      for(var i in relevantDetails){
        if(objects.connection[relevantDetails[i]] != null && typeof objects.connection[relevantDetails[i]] != 'function'){
          extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(objects.connection[relevantDetails[i]]));
        }
      }
    }

    else if(type === 'task'){
      extraMessages.push('! uncaught error from task: ' + name + ' on queue ' + objects.queue);
      extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
    }

    else {
      extraMessages.push('! Error: ' + err.message);
      extraMessages.push('!     Type: ' + type);
      extraMessages.push('!     Name: ' + name);
      extraMessages.push('!     Data: ' + JSON.stringify(objects));
    }

    for(var i in extraMessages){
      api.log(extraMessages[i], severity);
    }
    var lines = err.stack.split(os.EOL);
    for(var i in lines){
      var line = lines[i];
      api.log('! ' + line, severity);
    }
    api.log('*', severity);
  }

api.exceptionHandlers.reporters.push(consoleReporter);
{% endhighlight %}

## Example

{% highlight bash %}
2012-09-30 22:02:03 | [action @ web] to: 127.0.0.1 | action: {no action} | request: localhost:8080/ | params: {"action":""} | duration: 1
2012-09-30 22:02:07 | ! uncaught error from action: randomNumber
2012-09-30 22:02:07 | ! connection details:
2012-09-30 22:02:07 | !     action: "randomNumber"
2012-09-30 22:02:07 | !     remoteIP: "127.0.0.1"
2012-09-30 22:02:07 | !     type: "web"
2012-09-30 22:02:07 | !     params: {"action":"randomNumber"}
2012-09-30 22:02:07 | ! ReferenceError: anUnsetVariable is not defined
2012-09-30 22:02:07 | !     at Object.action.run (/Users/evantahler/PROJECTS/actionhero/actions/randomNumber.js:18:14)
2012-09-30 22:02:07 | !     at api.processAction.process.nextTick.api.actions.(anonymous function).run.connection.respondingTo (/Users/evantahler/PROJECTS/actionhero/initializers/initActions.js:118:40)
2012-09-30 22:02:07 | !     at Domain.bind.b (domain.js:201:18)
2012-09-30 22:02:07 | !     at Domain.run (domain.js:141:23)
2012-09-30 22:02:07 | !     at api.processAction.process.nextTick.connection.respondingTo (/Users/evantahler/PROJECTS/actionhero/initializers/initActions.js:117:21)
2012-09-30 22:02:07 | !     at process.startup.processNextTick.process._tickCallback (node.js:244:9)
2012-09-30 22:02:07 | *
2012-09-30 22:02:07 | [action @ web] to: 127.0.0.1 | action: randomNumber | request: localhost:8080/randomNumber | params: {"action":"randomNumber"} | duration: 4
2012-09-30 22:02:23 | [action @ web] to: 127.0.0.1 | action: status | request: localhost:8080/status | params: {"action":"status"} | duration: 1
{% endhighlight %}
