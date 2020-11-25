import * as glob from "glob";
import * as path from "path";
import { Plugin } from "node-resque";
import * as TaskModule from "./../modules/task";
import { api, log, utils, task, Initializer } from "../index";

const taskModule = task;

export interface TaskApi {
  tasks: { [key: string]: any };
  jobs: { [key: string]: any };
  middleware: { [key: string]: TaskModule.task.TaskMiddleware };
  globalMiddleware: Array<string>;
  loadFile?: Function;
  jobWrapper?: Function;
  loadTasks?: Function;
}

/**
 * Tools for enqueuing and inspecting the task system (delayed jobs).
 */
export class Tasks extends Initializer {
  constructor() {
    super();
    this.name = "tasks";
    this.loadPriority = 699;
    this.startPriority = 975;
  }

  async initialize(config) {
    api.tasks = {
      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: [],
    };

    api.tasks.loadFile = async (fullFilePath: string, reload = false) => {
      let task;
      let collection = await import(fullFilePath);
      for (const i in collection) {
        const TaskClass = collection[i];
        task = new TaskClass();
        task.validate();

        if (api.tasks.tasks[task.name] && !reload) {
          log(
            `an existing task with the same name \`${task.name}\` will be overridden by the file ${fullFilePath}`,
            "crit"
          );
        }

        api.tasks.tasks[task.name] = task;
        api.tasks.jobs[task.name] = api.tasks.jobWrapper(task.name);
        log(
          `task ${reload ? "(re)" : ""} loaded: ${task.name}, ${fullFilePath}`,
          "debug"
        );
      }
    };

    api.tasks.jobWrapper = (taskName: string) => {
      const task = api.tasks.tasks[taskName];

      const middleware = task.middleware || [];
      const plugins = task.plugins || [];
      const pluginOptions = task.pluginOptions || {};

      if (task.frequency > 0) {
        if (plugins.indexOf("JobLock") < 0) {
          plugins.push("JobLock");
          pluginOptions.JobLock = { reEnqueue: false };
        }
        if (plugins.indexOf("QueueLock") < 0) {
          plugins.push("QueueLock");
        }
        if (plugins.indexOf("DelayQueueLock") < 0) {
          plugins.push("DelayQueueLock");
        }
      }

      // load middleware into plugins
      const processMiddleware = (m) => {
        if (api.tasks.middleware[m]) {
          //@ts-ignore
          class NodeResquePlugin extends Plugin {
            constructor(...args) {
              //@ts-ignore
              super(...args);
              if (api.tasks.middleware[m].preProcessor) {
                //@ts-ignore
                this.beforePerform = api.tasks.middleware[m].preProcessor;
              }
              if (api.tasks.middleware[m].postProcessor) {
                //@ts-ignore
                this.afterPerform = api.tasks.middleware[m].postProcessor;
              }
              if (api.tasks.middleware[m].preEnqueue) {
                //@ts-ignore
                this.beforeEnqueue = api.tasks.middleware[m].preEnqueue;
              }
              if (api.tasks.middleware[m].postEnqueue) {
                //@ts-ignore
                this.afterEnqueue = api.tasks.middleware[m].postEnqueue;
              }
            }
          }

          plugins.push(NodeResquePlugin);
        }
      };

      api.tasks.globalMiddleware.forEach(processMiddleware);
      middleware.forEach(processMiddleware);

      return {
        plugins,
        pluginOptions,
        perform: async function () {
          const combinedArgs = [].concat(Array.prototype.slice.call(arguments));
          combinedArgs.push(this);
          let response = null;
          try {
            response = await task.run.apply(task, combinedArgs);
            await taskModule.enqueueRecurrentTask(taskName);
          } catch (error) {
            if (task.frequency > 0 && task.reEnqueuePeriodicTaskIfException) {
              await taskModule.enqueueRecurrentTask(taskName);
            }
            throw error;
          }
          return response;
        },
      };
    };

    api.tasks.loadTasks = async (reload) => {
      for (const i in config.general.paths.task) {
        const p = config.general.paths.task[i];
        await Promise.all(
          utils
            .ensureNoTsHeaderFiles(
              glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"))
            )
            .map((f) => api.tasks.loadFile(f, reload))
        );
      }

      for (const pluginName in config.plugins) {
        if (config.plugins[pluginName].tasks !== false) {
          const pluginPath = config.plugins[pluginName].path;

          // old style at the root of the project
          let files = glob.sync(path.join(pluginPath, "tasks", "**", "*.js"));

          files = files.concat(
            glob.sync(path.join(pluginPath, "dist", "tasks", "**", "*.js"))
          );

          utils.ensureNoTsHeaderFiles(files).forEach((f) => {
            api.tasks.loadFile(f, reload);
          });
        }
      }
    };

    await api.tasks.loadTasks(false);

    // we want to start the queue now, so that it's available for other initializers and CLI commands
    await api.resque.startQueue();
  }

  async start(config) {
    if (config.tasks.scheduler === true) {
      await taskModule.enqueueAllRecurrentTasks();
    }
  }
}
