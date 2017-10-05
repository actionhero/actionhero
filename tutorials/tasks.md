![](built-in-tasks.svg)

## Overview

Tasks are background jobs meant to be run separately from a client's request. They can be started by an action or by the server itself. With ActionHero, there is no need to run a separate daemon to process these jobs. ActionHero uses the [node-resque](https://github.com/taskrabbit/node-resque) package to store and process tasks in a way compatible with the [resque](https://github.com/resque/resque) ecosystem.

There are 3 types of tasks ActionHero can process: `normal`, `delayed`, and `periodic`.

* `normal` tasks are enqueued and processed one-by-one by the task TaskProcessors
* `delayed` tasks are enqueued in a special `delayed` queue to only be processed at some time in the future (defined either by a timestamp in ms or milliseconds-from-now)
* `periodic` tasks are like delayed tasks, but they run on a set frequency (e.g. every 5 minutes).
    * Periodic tasks can take no input parameters.

## Enqueing Tasks

Here are examples of the 3 ways to programmatically enqueue a task:

```js
// Enqueue the task now, and process it ASAP
// api.tasks.enqueue(nameOfTask, args, queue)
await api.tasks.enqueue("sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default')

// Enqueue the task now, and process it once \`timestamp\` has arrived
// api.tasks.enqueueAt(timestamp, nameOfTask, args, queue)
await api.tasks.enqueueAt(1234556, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default')

// Enqueue the task now, and process it once \`delay\` (ms) has passed
// api.tasks.enqueueIn(delay, nameOfTask, args, queue)
await api.tasks.enqueueIn(10000, "sendWelcomeEmail", {to: 'evan@evantahler.com'}, 'default')
```

"sendWelcomeEmail" should be a task defined in the project, and `{to: 'evan@evantahler.com'}` are arguments to that task. This task will be processed by TaskProcessors assigned to the "default" queue.

You can also enqueue tasks to be run at some time in the future (timestamp is in ms): `enqueueAt` asks for a timestamp (in ms) to run at, and `enqueueIn` asks for the number of ms from now to run.

The final type of task, periodic tasks, are defined with a `task.frequency` of greater than 0, and are loaded in by ActionHero when it boots. You cannot modify these tasks once the server is running.

## Processing Tasks

```js
// From /config/tasks.js:

exports.default = {
  tasks: function(api){
    return {
      // Should this node run a scheduler to promote delayed tasks?
      scheduler: false,
      // what queues should the TaskProcessors work?
      queues: ['*'],
      // Logging levels of task workers
      workerLogging : {
        failure   : 'error', // task failure
        success   : 'info',  // task success
        start     : 'info',
        end       : 'info',
        cleaning_worker : 'info',
        poll      : 'debug',
        job       : 'debug',
        pause     : 'debug',
        internalError : 'error',
        multiWorkerAction : 'debug'
      },
      // Logging levels of the task scheduler
      schedulerLogging : {
        start     : 'info',
        end       : 'info',
        poll      : 'debug',
        enqueue   : 'debug',
        reEnqueue : 'debug',
        working_timestamp : 'debug',
        transferred_job   : 'debug'
      },
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
      // Customize Resque primitives, replace null with required replacement.
      resque_overrides: {
        queue: null,
        multiWorker: null,
        scheduler: null
      }
    }
  }
}
```

To work these tasks, you need to run ActionHero with at least one `taskProcessor`. `TaskProcessor`s run in-line with the rest of your server and process jobs. This is controlled by settings in [/config/tasks.js](https://github.com/actionhero/actionhero/blob/master/config/tasks.js).

If you are enqueuing delayed or periodic tasks, you also need to enable the scheduler. This is a part of ActionHero that will periodically check the delayed queues for jobs that are ready to work now, and move them to the normal queues when the time comes.

Because node and ActionHero are asynchronous, we can process more than one job at a time. However, if the jobs we are processing are CPU-intensive, we want to limit how many we are working on at one time. To do this, we tell ActionHero to run somewhere between `minTaskProcessors` and `maxTaskProcessors` and check every so often if the server could be working more or less jobs at a time. Depending on the response characteristics you want for your server, you can modify these values.

In production, it is best to set up some ActionHero servers that only handle requests from clients (that is, servers with no TaskProcessors) and others that handle no requests, and only process jobs (that is, no servers, many `TaskProcessor`s).

As you noticed above, when you enqueue a task, you tell it which queue to be enqueued within. This is so you can separate load or priority. For example, you might have a `high` priority queue which does jobs like "sendPushMessage" and a `low` priority queue which does a task like "cleanupCache". You tell the `taskProcessor`s which jobs to work, and in which priority. For the example above, you would ensure that all `high` jobs happen before all `low` jobs by setting: `api.config.tasks.queues = ['high', 'low']`. You could also configure more nodes to work on the `high` queue than the `low` queue, thus further ensuring that `high` priority jobs are processed faster and sooner than `low` priority jobs.

## Creating A Task

An few ways to define a task:

```js
// define a single task in a file
const {api, Task} = require('actionhero')

module.exports = class SendWelcomeMessage extends Task {
  constructor () {
    super()
    this.name = 'SendWelcomeEmail'
    this.description = 'I send the welcome email to new users'
    this.frequency = 0
    this.queue = 'high'
    this.middleware = []
  }

  async run (data) {
    await api.sendWelcomeEamail({address: data.email})
    return true
  }
}
```

You can also define more than one task in a file, exporting each with a separate `exports` directive, ie:.

```js
exports.SayHello = class SayHello extends Task {
  constructor () {
    super()
    this.name = 'sayHello'
    this.description = 'I say hello'
    this.frequency = 1000
    this.queue = 'low'
    this.middleware = []
  }

  async run () { api.log("hello") }
}

exports.SayGoodbye = class SayGoodbye extends Task {
  constructor () {
    super()
    this.name = 'sayGoodbye'
    this.description = 'I say goodbye'
    this.frequency = 2000
    this.queue = 'low'
    this.middleware = []
  }

  async run () { api.log("goodbye") }
}
```

Output of the above:

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

You can create you own tasks by placing them in a `./tasks/` directory at the root of your application. You can use the generator `actionhero generate task --name=myTask`. Like actions, all tasks have some required metadata:

* `task.name`: The unique name of your task
* `task.description`: a description
* `task.queue`: the default queue to run this task within (can be overwritten when enqueued)
* `task.frequency`: In milliseconds, how often should I run?. A frequency of `> 0` denotes this task as periodic and ActionHero will automatically enqueued when the server boots. Only one instance of a periodic task will be enqueued within the cluster at a time, regardless of how many ActionHero nodes are connected.
* `task.midleware`: midleware modify how your tasks are enqueued. For example, if you use the `queue-lock` plugin, only one instance of any job (with similar arguments) can be enqueued at a time. You can [learn more about midleware here](tutorial-middleware.html)

`task.run` contains the actual work that the task does. It takes the following arguments:

* `params`: An array of parameters that the task was enqueued with. This is whatever was passed as the second argument to `api.tasks.enqueue`.  

Throwing an error will stop the task, and log it as a failure in resque, which you can inspect via the various [tasks](api.tasks.html) methods.  If a periodic task throws an error, it will not be run again.

## Job Schedules

You may want to schedule jobs every minute/hour/day, like a distributed CRON job. There are a number of excellent node packages to help you with this, like [node-schedule](https://github.com/tejasmanohar/node-schedule) and [node-cron](https://github.com/ncb000gt/node-cron). ActionHero exposes [node-resque's](https://github.com/taskrabbit/node-resque) scheduler to you so you can use the scheduler package of your choice.

Assuming you are running ActionHero across multiple machines, you will need to ensure that only one of your processes is actually scheduling the jobs. To help you with this, you can inspect which of the scheduler processes is correctly acting as master, and flag only the master scheduler process to run the schedule. An [initializer for this](tutorial-initializers.html) would look like:

```js
// file: initializers/node_schedule.js

const schedule = require('node-schedule')
const {api, Initializer} = require('node-schedule')

module.exports = class Scheduler extends Initializer {
  constructor () {
    super()
    this.name = 'scheduler'
  }

  initialize (api, next) {
    api.scheduledJobs = [];
  },

  start () {
    // do this job every 10 seconds, cron style
    const job = schedule.scheduleJob('0,10,20,30,40,50 * * * * *', () => {
      // we want to ensure that only one instance of this job is scheduled in our environment at once,
      // no matter how many schedulers we have running
      if(api.resque.scheduler && api.resque.scheduler.master){
        await api.tasks.enqueue('sayHello', {time: new Date().toString()}, 'default')
      }
    })

    api.scheduledJobs.push(job)
  },

  stop: () => {
    api.scheduledJobs.forEach((job) => { job.cancel() })
  }
};
```

Be sure to have the scheduler enabled on at least one of your ActionHero servers!

## Failed Job Management

Sometimes a worker crashes is a severe way, and it doesn't get the time/chance to notify redis that it is leaving the pool (this happens all the time on PAAS providers like Heroku). When this happens, you will not only need to extract the job from the now-zombie worker's "working on" status, but also remove the stuck worker. To aid you in these edge cases, `api.tasks.cleanOldWorkers(age)` is available.

Because there are no 'heartbeats' in resque, it is impossible for the application to know if a worker has been working on a long job or it is dead. You are required to provide an "age" for how long a worker has been "working", and all those older than that age will be removed, and the job they are working on moved to the error queue (where you can then use `api.tasks.retryAndRemoveFailed`) to re-enqueue the job.

You can handle this with an own initializer and the following logic:

```js
const removeStuckWorkersOlderThan = 10000; // 10000ms
api.log(`removing stuck workers solder than ${removeStuckWorkersOlderThan}ms`, 'info');
const result = api.tasks.cleanOldWorkers(removeStuckWorkersOlderThan)
if(Object.keys(result).length > 0){
  api.log('removed stuck workers with errors: ', 'info', result);
}
```

## Notes

Note that the `frequency`, `enqueueIn` and `enqueueAt` times are when a task is **allowed** to run, not when it **will** run. TaskProcessors will work tasks in a first-in-first-out manner. TaskProcessors also `sleep` when there is no work to do, and will take some time (default 5 seconds) to wake up and check for more work to do.

Remember that each ActionHero server uses one thread and one event loop, so that if you have computationally intensive task (like computing Fibonacci numbers), this **will** block tasks, actions, and clients from working. However, if your tasks are meant to communicate with external services (reading from a database, sending an email, etc), then these are perfect candidates to be run simultaneously as the single thread can work on other things while waiting for these operations to complete.

If you are running a single ActionHero server, all tasks will be run locally. As you add more servers, the work will be split evenly across all nodes. It is very likely that your job will be run on different nodes each time.
