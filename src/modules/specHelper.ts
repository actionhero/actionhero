import * as uuid from "uuid";
import { Worker } from "node-resque";
import { api, config, task, Task, Action, Connection } from "./../index";
import { WebServer } from "../servers/web";
import { AsyncReturnType } from "type-fest";
import { TaskInputs } from "../classes/task";

export type SpecHelperConnection = Connection & {
  actionCallbacks?: { [key: string]: Function };
};

export namespace specHelper {
  /**
   * Generate a connection to use in your tests
   */
  export async function buildConnection() {
    return api.specHelper.Connection.createAsync() as SpecHelperConnection;
  }

  /**
   * Run an action via the specHelper server.
   */
  export async function runAction<A extends Action | void = void>(
    actionName: string,
    input: Partial<SpecHelperConnection> = {}
  ) {
    let connection: SpecHelperConnection;

    if (input.id && input.type === "testServer") {
      connection = input as SpecHelperConnection;
    } else {
      connection = await specHelper.buildConnection();
      connection.params = input;
    }

    connection.params.action = actionName;

    connection.messageId = connection.params.messageId || uuid.v4();

    const response: (A extends Action
      ? AsyncReturnType<A["run"]>
      : { [key: string]: any }) & {
      messageId?: string;
      error?: NodeJS.ErrnoException | string | any;
      requesterInformation?: ReturnType<WebServer["buildRequesterInformation"]>;
      serverInformation?: ReturnType<WebServer["buildServerInformation"]>;
    } = await new Promise((resolve) => {
      api.servers.servers.testServer.processAction(connection);
      connection.actionCallbacks[connection.messageId] = resolve;
    });

    return response;
  }

  /**
   * Mock a specHelper connection requesting a file from the server.
   */
  export async function getStaticFile(file: string): Promise<any> {
    const connection = await specHelper.buildConnection();
    connection.params.file = file;

    const response = await new Promise((resolve) => {
      api.servers.servers.testServer.processFile(connection);
      connection.actionCallbacks[connection.messageId] = resolve;
    });

    return response;
  }

  /**
   * Use the specHelper to run a task.
   * Note: this only runs the task's `run()` method, and no middleware.  This is faster than api.specHelper.runFullTask.
   */
  export async function runTask<T extends Task | void = void>(
    taskName: string,
    params: object | Array<any>
  ) {
    if (!api.tasks.tasks[taskName]) {
      throw new Error(`task ${taskName} not found`);
    }

    const result: (T extends Task
      ? AsyncReturnType<T["run"]>
      : { [key: string]: any }) & {
      error?: NodeJS.ErrnoException | string;
    } = await api.tasks.tasks[taskName].run(params, undefined);
    return result;
  }

  /**
   * Use the specHelper to run a task.
   * Note: this will run a full Task worker, and will also include any middleware.  This is slower than api.specHelper.runTask.
   */
  export async function runFullTask<T extends Task | void = void>(
    taskName: string,
    params: object | Array<any>
  ) {
    const worker = new Worker(
      {
        connection: {
          redis: api.redis.clients.tasks,
          pkg:
            api.redis.clients.tasks?.constructor?.name === "RedisMock"
              ? "ioredis-mock"
              : "ioredis",
        },
        queues: (Array.isArray(config.tasks.queues)
          ? config.tasks.queues
          : await config.tasks.queues()) || ["default"],
      },
      api.tasks.jobs
    );

    try {
      await worker.connect();

      const result: (T extends Task
        ? AsyncReturnType<T["run"]>
        : { [key: string]: any }) & {
        error?: string;
      } = await worker.performInline(
        taskName,
        Array.isArray(params) ? params : [params]
      );
      await worker.end();
      return result;
    } catch (error) {
      try {
        worker.end();
      } catch (error) {}
      throw error;
    }
  }

  /**
   * Use the specHelper to find enqueued instances of a task
   * This will return an array of instances of the task which have been enqueued either in the normal queues or delayed queues
   * If a task is enqueued in a delayed queue, it will have a 'timestamp' property
   * i.e. [ { class: 'regularTask', queue: 'testQueue', args: [ [Object] ] } ]
   */
  export async function findEnqueuedTasks(taskName: string) {
    let found: TaskInputs[] = [];

    // normal queues
    const queues = await api.resque.queue.queues();
    for (const i in queues) {
      const q = queues[i];
      const length = await api.resque.queue.length(q);
      const batchFound = await task.queued(q, 0, length + 1);
      let matches = batchFound.filter((t) => t.class === taskName);
      matches = matches.map((m) => {
        m.timestamp = null;
        return m;
      });
      found = found.concat(matches);
    }

    // delayed queues
    const allDelayed = await api.resque.queue.allDelayed();
    for (const timestamp in allDelayed) {
      let matches = allDelayed[timestamp].filter((t) => t.class === taskName);
      matches = matches.map((m) => {
        m.timestamp = parseInt(timestamp);
        return m;
      });
      found = found.concat(matches);
    }

    return found;
  }

  /**
   * Delete all enqueued instances of a task, both in all the normal queues and all of the delayed queues
   */
  export async function deleteEnqueuedTasks(taskName: string, params: {}) {
    const queues = await api.resque.queue.queues();
    for (const i in queues) {
      const q = queues[i];
      await api.resque.queue.del(q, taskName, [params]);
      await api.resque.queue.delDelayed(q, taskName, [params]);
    }
  }
}
