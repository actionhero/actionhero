# Tasks

## General

Tasks are background jobs meant to be run separately from a client's request.  They can be started by an action or by the server itself.  With actionhero, there is no need to run a separate daemon to process these jobs.  actionhero uses the [node-resque](https://github.com/taskrabbit/node-resque) package to store and process tasks in a way compatible with the [resque](https://github.com/resque/resque) ecosystem.

There are 3 types of tasks actionhero can process: `normal`, `delayed`, and `periodic`.

  * `normal` tasks are enqueued and processed one-by-one by the task TaskProcessors
  * `delayed` tasks are enqueued in a special 'delayed' queue to only be processed at some time in the future (defined either by a timestamp in ms or miliseconds-from-now)
  * `periodic` tasks are like delayed tasks, but they run on a set frequency (e.g. every 5 minutes).  
    * Periodic tasks can take no input parameters.

## Enqueuing a Task

```javascript
// Enqueue the task now, and process it ASAP
// api.tasks.enqueue(nameOfTask, args, queue, callback)
api.tasks.enqueue("sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // enqueued!
});

// Enqueue the task now, and process it once `timestamp` has arrived
// api.tasks.enqueueAt(timestamp, nameOfTask, args, queue, callback)
api.tasks.enqueueAt(1234556, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // enqueued!
});

// Enqueue the task now, and process it once `delay` (ms) has passed
// api.tasks.enqueueIn(delay, nameOfTask, args, queue, callback)
api.tasks.enqueueIn(10000, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default', function(err, toRun){
  // enqueued!
});
```

Here are examples of the 3 ways to programatically enqueue a task.

"sendWelcomeEmail" should be a task defined in the project, and `{to: 'evan@evantahler.com'}` are arguments to that task.  This task will be processed by TaskProcessors assigned to the 'default queue'.

You can also enqueue tasks to be run at some time in the future (timestamp is in ms):

`enqueueAt` asks for a timestamp (in ms) to run at, and `enqueueIn` asks for the number of ms from now to run.

The final type of task, periodic tasks, are defined with a `task.frequency` of greater than 0, and are loaded in by actionhero when it boots.  You cannot modify these tasks once the server is running.

## Processing Tasks

```javascript
// From /config/tasks.js:

exports.default = { 
  tasks: function(api){
    return {
      // Should this node run a scheduler to promote delayed tasks?
      scheduler: false,
      // what queues should the TaskProcessors work?
      queues: ['*'],
      // how long to sleep between jobs / scheduler checks
      timeout: 5000,
      // at minimum, how many parallel taskProcessors should this node spawn?
      // (have number > 0 to enable, and < 1 to disable)
      minTaskProcessors: 0,
      // at maximum, how many parallel taskProcessors should this node spawn?
      maxTaskProcessors: 0,
      // how often should we check the event loop to spawn more TaskProcessors?
      checkTimeout: 500,
      // how many ms would constitue an event loop delay to halt TaskProcessors spawning?
      maxEventLoopDelay: 5,
      // When we kill off a taskProcessor, should we disonnect that local redis connection?
      toDisconnectProcessors: true,
      // What redis server should we connect to for tasks / delayed jobs?
      redis: api.config.redis
    }
  }
}
```

To work these tasks, you need to run actionhero with at least one `taskProcessor`.  `TaskProcessor`s run in-line with the rest of your server and process jobs.  This is controlled by settings in [/config/tasks.js](https://github.com/evantahler/actionhero/blob/master/config/tasks.js).

If you are enqueuing delayed or periodic tasks, you also need to enable the scheduler.  This is a part of actionhero that will periodically check the delayed queues for jobs that are ready to work now, and move them to the normal queues when the time comes.

Because node and actionhero are asynchronous, we can process more than one job at a time.  However, if the jobs we are processing are CPU-intensive, we want to limit how many we are working on at one time.  To do this, we tell actionhero to run somewhere between `minTaskProcessors` and `maxTaskProcessors` and check every so often if the server could be working more or less jobs at a time.  Depending on the response characteristics you want for your server, you can modify these values.  

In production, it is best to set up some actionhero servers that only handle requests from clients (that is, servers with no TaskProcessors) and others that handle no requests, and only process jobs (that is, no servers, many `TaskProcessor`s).

As you noticed above, when you enqueue a task, you tell it which queue to be enqueued within.  This is so you can separate load or priority.  For example, you might have a `high` priority queue which does jobs like "sendPushMessage" and a `low` priority queue which does a task like "cleanupCache".  You tell the `taskProcessor`s which jobs to work, and in which priority. For the example above, you would ensure that all `high` jobs happen before all `low` jobs by setting: `api.config.tasks.queues = ['high', 'low']`.
You could also configure more nodes to work on the `high` queue than the `low` queue, thus further ensuring that `high` priority jobs are processed faster and sooner than `low` priority jobs.

## Creating a Task

```javascript
// define a single task in a file

var task = {
  name:          "sendWelcomeEmail",
  description:   "I will send a new user a welcome email",
  queue:         "default",
  plugins:       [], 
  pluginOptions: [], 
  frequency:     0,
  run: function(api, params, next){
    api.sendEmail(params.email, function(err){
      next(err); //task will fail if sendEmail does
    })
  }
};

exports.task = task;

// define multiple tasks (so you can share methods)

exports.sayHello = {
  name:          'sayHello',
  description:   'I say hello',
  queue:         "default",
  plugins:       [], 
  pluginOptions: [],
  frequency:     1000,
  run: function(api, params, next){
    api.log("hello")
    next();
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
    next();
  }
};
```

```bash
# The output of running the last 2 tasks would be:

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
```

You can create you own tasks by placing them in a `./tasks/` directory at the root of your application.  You can use the generator `actionhero generateTask --name=myTask`. Like actions, all tasks have some required metadata:

* `task.name`: The unique name of your task
* `task.description`: a description
* `task.queue`: the default queue to run this task within (can be overwritten when enqueued)
* `task.frequency`: In milliseconds, how often should I run?.  A frequency of >0 denotes this task as periodic and actionhero will automatically enqueued when the server boots.  Only one instance of a periodic task will be enqueued within the cluster at a time, regardless of how many actionhero nodes are connected.
* `task.plugins`: You can use resque plugins in your task from the node-resque project.  Plugins modify how your tasks are enqueued.  For example, if you use the `queue-lock` plugin, only one instance of any job (with similar arguments) can be enqueued at a time.  You can learn more about plugins from the [node-resque project](https://github.com/taskrabbit/node-resque#plugins).
* `task.pluginOptions`: a hash of options for the plugins

`task.run` contains the actual work that the task does. It takes the following arguments:

* `api`: The actionhero api object
* `params`: An array of parameters that the task was enqueued with. This is whatever was passed as the second argument to `api.tasks.enqueue`
* `next`: A callback to call when the task is done. This callback is of the type `function(error, result)`. 
  * Passing an `error` object will cause the job to be marked as a failure. 
  * The result is currently not captured anywhere.
    

## Queue Inspection
actionhero provides some methods to help inspect the state of your queue.  You can use these methods to check if your jobs are processing in a timely manner, if there are errors in task processing, etc.

### api.tasks.scheduledAt(queue, taskName, args, next)
- next(err, timestamps)
- finds all matching instances of queue + taskName + args from the delayed queues
- timestamps will be an array of the delayed timestamps

### api.tasks.del(queue, taskName, args, count, next)
- next(err, count)
- removes all matching instances of queue + taskName + args from the normal queues
- count is how many instances of this task were removed

### api.tasks.delDelayed(queue, taskName, args, next)
- next(err, timestamps)
- removes all matching instances of queue + taskName + args from the delayed queues
- timestamps will be an array of the delayed timestamps which the task was removed from

### api.tasks.enqueueRecurrentJob(taskName, next)
- next()
- will enqueue are recurring job
- might not actually enqueue the job if it is already enqueued due to resque plugins

### api.tasks.stopRecurrentJob(taskName, next)
- next(err, removedCount)
- will remove all instances of `taskName` from the delayed queues and normal queues
- removedCount will inform you of how many instances of this job were removed

### api.tasks.timestamps(next)
- next(err, timestamps)
- will return an array of all timesamps which have at least one job scheduled to be run 
- for use with `api.tasks.delayedAt`

### api.tasks.delayedAt(timestamp, next)
- next(err, jobs)
- will return the list of jobs enqueued to run after this timestamp

### api.tasks.allDelayed(next)
- next(err, jobs)
- will return the list of all jobs enqueued by the timestamp they are enqueued to run at

### api.tasks.workers(next)
- next(err, workers)
- list all taskProcessors

### api.tasks.workingOn(workerName, queues, next)
- next(err, status)
- list what a specific taskProcessors (defined by the name of the server + queues) is working on (or sleeping)

### api.tasks.allWorkingOn(next)
- next(err, workers)
- list what all taskProcessors are working on (or sleeping)

### api.tasks.details(next)
- next(err, details)
- details is a hash of all the queues in the system and how long they are
- this method also returns metadata about the taskProcessors and what they are currently working on

### api.tasks.failedCount(next)
- next(err, failedCount)
- `failedCount` is how many resque jobs are in the failed queue.

### api.tasks.failed(start, stop, next)
- next(err, failedJobs)
- `failedJobs` is an array listing the data of the failed jobs.  You can see an example at https://github.com/taskrabbit/node-resque#failed-job-managment

### api.tasks.removeFailed(failedJob, next)
- next(err, removedCount)
- the input `failedJob` is an expanded node object representing the failed job, retrieved via `api.tasks.failed`

### api.tasks.retryAndRemoveFailed(failedJob, next)
- next(err, failedJob)
- the input `failedJob` is an expanded node object representing the failed job, retrieved via `api.tasks.failed`

## Job Schedules

```javascript
// file: initializers/node_schedule.js

var schedule = require('node-schedule');

module.exports = {
  initialize: function(api, next){
    api.scheduledJobs = [];
    next();
  },

  start: function(api, next){
    
    // do this job every 10 seconds, cron style
    var job = schedule.scheduleJob('0,10,20,30,40,50 * * * * *', function(){ 
      // we want to ensure that only one instance of this job is scheduled in our environment at once, 
      // no matter how many schedulers we have running

      if(api.resque.scheduler && api.resque.scheduler.master){ 
        api.tasks.enqueue('sayHello', {time: new Date().toString()}, 'default', function(error){
          if(error){ api.log(error, 'error'); }
        });
      }
    });

    api.scheduledJobs.push(job);

    next();
  },

  stop: function(api, next){
    api.scheduledJobs.forEach(function(job){
      job.canel();
    });

    next();
  }
};
```

You may want to schedule jobs every minute/hour/day, like a distributed CRON job.  There are a number of excellent node packages to help you with this, like [node-schedule](https://github.com/tejasmanohar/node-schedule) and [node-cron](https://github.com/ncb000gt/node-cron).  Actionhero exposes [node-resque's](https://github.com/taskrabbit/node-resque) scheduler to you so you can use the scheduler package of your choice.  

Assuming you are running actionhero across multiple machines, you will need to ensure that only one of your processes is actually scheduling the jobs.  To help you with this, you can inspect which of the scheduler processes is correctly acting as master, and flag only the master scheduler process to run the schedule.  An [initializer for this](/docs#initializers) would look like:

Be sure to have the scheduler enabled on at least one of your actionhero servers! 

## Failed Job Management

```javascript

var removeStuckWorkersOlderThan = 10000; // 10000ms
api.log('removing stuck workers solder than ' + removeStuckWorkersOlderThan + 'ms', 'info');
api.tasks.cleanOldWorkers(removeStuckWorkersOlderThan, function(err, result){
  if(err){
    api.log(err, 'error'); 
  }
  if(Object.keys(result).length > 0){
    api.log('removed stuck workers with errors: ', 'info', result);
  }
  callback();
});

```

Sometimes a worker crashes is a severe way, and it doesn't get the time/chance to notify redis that it is leaving the pool (this happens all the time on PAAS providers like Heroku). When this happens, you will not only need to extract the job from the now-zombie worker's "working on" status, but also remove the stuck worker. To aid you in these edge cases, `api.tasks.cleanOldWorkers(age, callback)` is available.

Because there are no 'heartbeats' in resque, it is impossible for the application to know if a worker has been working on a long job or it is dead. You are required to provide an "age" for how long a worker has been "working", and all those older than that age will be removed, and the job they are working on moved to the error queue (where you can then use `api.tasks.retryAndRemoveFailed`) to re-enqueue the job.

You can handle this with an own initializer and the following logic => 

## Notes

Note that the `frequency`, `enqueueIn` and `enqueueAt` times are when a task is **allowed** to run, not when it **will** run.  TaskProcessors will work tasks in a first-in-first-out manner.  TaskProcessors also `sleep` when there is no work to do, and will take some time (default 5 seconds) to wake up and check for more work to do.

Remember that each actionhero server uses one thread and one event loop, so that if you have computationally intensive task (like computing Fibonacci numbers), this **will** block tasks, actions, and clients from working.  However, if your tasks are meant to communicate with external services (reading from a database, sending an email, etc), then these are perfect candidates to be run simultaneously as the single thread can work on other things while waiting for these operations to complete.  

Tasks are stored in redis.  Be sure to enable non-fake redis if you want your tasks to persist and be shared across more than one actionhero server.

If you are running a single actionhero server, all tasks will be run locally.  As you add more servers, the work will be split evenly across all nodes.  It is very likely that your job will be run on different nodes each time.
