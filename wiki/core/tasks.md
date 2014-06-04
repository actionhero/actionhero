---
layout: wiki
title: Wiki - Tasks
---

# Tasks

## General

Tasks are background jobs meant to be run separately from a client's request.  They can be started by an action or by the server itself.  With actionhero, there is no need to run a separate daemon to process these jobs.  actionhero uses the [node-resque](https://github.com/taskrabbit/node-resque) package to store and process tasks in a way compatible with the [resque](https://github.com/resque/resque) ecosystem. There are [a number of example tasks provided](Example-tasks).

There are 3 types of tasks actionhero can process: `normal`, `delayed`, and `periodic`.

  * `normal` tasks are enqueued and processed one-by-one by the task workers
  * `delayed` tasks are enqueued in a special 'delayed' queue to only be processed at some time in the future (defined either by a timestamp or seconds-from-now)
  * `periodic` tasks are like delayed tasks, but they run on a set frequency (e.g. every 5 minutes).  Delayed tasks can take no input parameters.

## Enqueuing a Task

When enqueuing a task from your code, it's as simple as

{% highlight javascript %}
api.tasks.enqueue("sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // done!
});
{% endhighlight %}

"sendWelcomeEmail" should be a task defined in the project, and `{to: 'evan@evantahler.com'}` are arguments to that task.  This task will be processed by workers assigned to the 'default queue'.

You can also enqueue tasks to be run at some time in the future:

{% highlight javascript %}
api.tasks.enqueueAt(1234556, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // done!
});
{% endhighlight %}

or

{% highlight javascript %}
api.tasks.enqueueIn(10000, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // done!
});
{% endhighlight %}

`enqueueAt` asks for a timestamp to run at, and `enqueueIn` asks for the number of ms from now to run.

The final type of task, periodic tasks, are defined with a `task.frequency` of greater than 0, and are loaded in by actionhero when it boots.

## Processing Tasks

To work these tasks, you need to run actionhero with at least one worker.  Workers are defined by the queues they are to work within `config/tasks.js`.  Workers run in-line with the rest of your server and process jobs.  

If you are enqueuing delayed or periodic tasks, you also need to enable the scheduler.  This is a part of actionhero that will periodically check the delayed queues for jobs that are ready to work now, and pass them to the normal queues.

If I wanted to run 2 workers and a scheduler to run the jobs enqueued in the default queues above, I would do the following:

{% highlight javascript %}
config.tasks = {
  scheduler: true,    
  queues: ['default', 'default'],   
  timeout: 5000,
  redis: config.redis,
}
{% endhighlight %}

You can also set workers to work the `"*"` queue, and process any job they can find.

## Creating a Task

You can create you own tasks by placing them in a `./tasks/` directory at the root of your application.  You can use the generator `actionhero generateTask --name=myTask`. Like actions, all tasks have some required metadata:

* `task.name`: The unique name of your task
* `task.description`: a description
* `task.queue`: the default queue to run this task within (can be overwritten when enqueued)
* `task.frequency`: In milliseconds, how often should I run?.  A frequency of >0 denotes this task as periodic and actionhero will automatically enqueue it when required.
* `task.plugins`: You can use resque plugins in your task from the node-resque project.  Plugins modify how your tasks are enqueued.  For example, if you use the `queue-lock` plugin, only one instance of any job (with similar arguments) can be enqueued at a time.
* `task.pluginOptions`: a hash of options for the plugins
    

An example Task:

{% highlight javascript %}
var task = {
  name:          "sendWelcomeEmail",
  description:   "I will send a new user a welcome email",
  queue:         "default",
  plugins:       [], 
  pluginOptions: [], 
  frequency:     0,
  run: function(api, params, next){
    api.sendEmail(params.email, function(err){
      if(err != null){ api.log(err, 'error'); }
      next();
    })
  }
};

exports.task = task;
{% endhighlight %}

You can also define more than one task in a single file:

{% highlight javascript %}

exports.sayHello = {
  name:          'sayHello',
  description:   'I say hello',
  queue:         "default",
  plugins:       [], 
  pluginOptions: [],
  frequency:     1000,
  run: function(api, params, next){
    api.log("hello")
    next(null, true);
  }
};

exports.sayGoodbye = {
  name:          'sayGoodbye',
  description:   'I say goodbye',
  queue:         "default",
  plugins:       [], 
  pluginOptions: [],
  frequency:     2000,
  run: function(api, params, next){
    api.log("goodbye")
    next(null, true);
  }
};

{% endhighlight %}

If you run these 2 tasks, you will see output in your console like this:

{% highlight bash %}
2013-11-28 15:21:56 - debug: resque scheduler working timestamp 1385680913
2013-11-28 15:21:56 - debug: resque scheduler enquing job 1385680913 class=sayHello, queue=default,
2013-11-28 15:21:56 - debug: resque scheduler working timestamp 1385680914
2013-11-28 15:21:56 - debug: resque scheduler enquing job 1385680914 class=sayGoodbye, queue=default,
2013-11-28 15:21:56 - debug: resque worker #1 working job default class=sayHello, queue=default,
2013-11-28 15:21:56 - info: hello
2013-11-28 15:21:56 - debug: re-enqueued reccurent job sayHello
2013-11-28 15:21:56 - debug: resque worker #1 working job default class=sayGoodbye, queue=default,
2013-11-28 15:21:56 - info: goodbye
2013-11-28 15:21:56 - debug: re-enqueued reccurent job sayGoodbye
{% endhighlight %}

## Queue Inspection
actionhero provides some methods to help inspect the state of your queue

#### api.tasks.del(queue, taskName, args, count, next)
- next(err, count)
- removes all matching instances of queue + taskName + args from the normal queues
- count is how many instances of this task were removed

#### api.tasks.delDelayed(queue, taskName, args, next)
- next(err, timestamps)
- removes all matching instances of queue + taskName + args from the delayed queues
- timestamps will be an array of the delayed timestamps which the task was removed from

#### api.tasks.enqueueRecurrentJob(taskName, next)
- next()
- will enqueue are recurring job
- might not actually enqueue the job if it is already enqueued due to resque plugins

#### api.tasks.stopRecurrentJob(taskName, next)
- next(err, removedCount)
- will remove all instances of `taskName` from the delayed queues and normal queues
- removedCount will inform you of how many instances of this job were removed

#### api.tasks.details(next)
- next(err, details)
- details is a hash of all the queues in the system and how long they are

## Notes

Note that the `frequency`, `enqueueIn` and `enqueueAt` times are when a task is **allowed** to run, not when it **will** run.  Workers will work tasks in a first-in-first-out manner.  Workers also `sleep` when there is no work to do, and will take some time (default 5 seconds) to wake up and check for more work to do.

Remember that each actionhero server uses one thread and one event loop, so that if you have computationally intensive task (like computing Fibonacci numbers), this **will** block tasks, actions, and clients from working.  However, if your tasks are meant to communication with external services (reading from a database, sending an email, etc), then these are perfect candidates to be run simultaneously.  

Tasks are stored in redis.  Be sure to enable non-fake redis if you want your tasks to persist and be shared across more than one actionhero server.

If you are running a single actionhero server, all tasks will be run locally.  Once you add more servers, the work will be split evenly across all nodes.  It is very likely that your job will be run on different nodes each time.
