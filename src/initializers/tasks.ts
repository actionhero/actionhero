import * as glob from "glob";
import * as path from "path";
import { Plugin } from "node-resque";
import * as TaskModule from "./../modules/task";
import { api, config, log, utils, task, Initializer } from "../index";
import { Task } from "../classes/task";
import { PluginConfig } from "../classes/config";

const taskModule = task;

export interface TaskApi {
  tasks: { [key: string]: Task };
  jobs: { [key: string]: any };
  middleware: { [key: string]: TaskModule.task.TaskMiddleware };
  globalMiddleware: Array<string>;
  loadFile?: TasksInitializer["loadFile"];
  jobWrapper?: TasksInitializer["jobWrapper"];
  loadTasks?: TasksInitializer["loadTasks"];
}

/**
 * Tools for enqueuing and inspecting the task system (delayed jobs).
 */
export class TasksInitializer extends Initializer {
  constructor() {
    super();
    this.name = "tasks";
    this.loadPriority = 699;
    this.startPriority = 975;
  }

  loadFile = async (fullFilePath: string, reload = false) => {
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

  jobWrapper = (taskName: string) => {
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
    const processMiddleware = (m: string) => {
      if (api.tasks.middleware[m]) {
        //@ts-ignore
        class NodeResquePlugin extends Plugin {
          //@ts-ignore
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

        //@ts-ignore
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

  loadTasks = async (reload: boolean) => {
    for (const p of config.get<string[]>("general", "paths", "task")) {
      await Promise.all(
        utils
          .ensureNoTsHeaderFiles(
            glob.sync(path.join(p, "**", "**/*(*.js|*.ts)"))
          )
          .map((f) => api.tasks.loadFile(f, reload))
      );
    }

    for (const [pluginName, plugin] of Object.entries(
      config.get<PluginConfig>("plugins")
    )) {
      // old style at the root of the project
      let files = glob.sync(path.join(plugin.path, "tasks", "**", "*.js"));

      files = files.concat(
        glob.sync(path.join(plugin.path, "dist", "tasks", "**", "*.js"))
      );

      utils.ensureNoTsHeaderFiles(files).forEach((f) => {
        api.tasks.loadFile(f, reload);
      });
    }
  };

  async initialize() {
    api.tasks = {
      tasks: {},
      jobs: {},
      middleware: {},
      globalMiddleware: [],
      loadFile: this.loadFile,
      jobWrapper: this.jobWrapper,
      loadTasks: this.loadTasks,
    };

    await api.tasks.loadTasks(false);

    // we want to start the queue now, so that it's available for other initializers and CLI commands
    await api.resque.startQueue();
  }

  async start() {
    if (config.get<boolean>("tasks", "scheduler") === true) {
      await taskModule.enqueueAllRecurrentTasks();
    }
  }
}
