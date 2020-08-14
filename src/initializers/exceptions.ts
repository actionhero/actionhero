import * as os from "os";
import { api, log, Initializer } from "../index";

export interface ExceptionHandlerAPI {
  reporters: Array<any>;
  report: Function;
  loader?: Function;
  action?: Function;
  task?: Function;
}

/**
 * Handlers for when things go wrong.
 */
export class Exceptions extends Initializer {
  constructor() {
    super();
    this.name = "exceptions";
    this.loadPriority = 130;
  }

  relevantDetails() {
    return ["action", "remoteIP", "type", "params", "room"];
  }

  async initialize(config) {
    api.exceptionHandlers = {
      reporters: [],
      report: (error, type, name, objects, severity) => {
        if (!severity) {
          severity = "error";
        }
        for (const i in api.exceptionHandlers.reporters) {
          api.exceptionHandlers.reporters[i](
            error,
            type,
            name,
            objects,
            severity
          );
        }
      },
    };

    api.exceptionHandlers.loader = (fullFilePath, error) => {
      const name = "loader:" + fullFilePath;
      api.exceptionHandlers.report(
        error,
        "loader",
        name,
        { fullFilePath: fullFilePath },
        "alert"
      );
    };

    api.exceptionHandlers.action = (
      error,
      { to, action, params, duration, response }
    ) => {
      api.exceptionHandlers.report(
        error,
        "action",
        `action: ${action}`,
        { to, action, params, duration, error, response },
        "alert"
      );
    };

    api.exceptionHandlers.task = (error, queue, task, workerId) => {
      let simpleName;
      try {
        simpleName = task.class;
      } catch (e) {
        simpleName = error.message;
      }
      const name = "task:" + simpleName;
      api.exceptionHandlers.report(
        error,
        "task",
        name,
        { task: task, queue: queue, workerId: workerId },
        config.tasks.workerLogging.failure
      );
    };

    const consoleReporter = (error, type, name, objects, severity) => {
      let message = "";
      const data = {};

      if (type === "action") {
        // no need to log anything, it was handled already by the actionProcessor
      } else if (type === "loader") {
        message = `Failed to load ${objects.fullFilePath}`;
      } else if (type === "task") {
        message = `error from task`;
        data["name"] = name;
        data["queue"] = objects.queue;
        data["worker"] = objects.workerId;
        data["arguments"] = objects?.task?.args
          ? JSON.stringify(objects.task.args[0])
          : undefined;
      } else {
        message = `Error: ${error?.message || error.toString()}`;
        Object.getOwnPropertyNames(error)
          .filter((prop) => prop !== "message")
          .sort((a, b) => (a === "stack" || b === "stack" ? -1 : 1))
          .forEach((prop) => (data[prop] = error[prop]));
        data["type"] = type;
        data["name"] = name;
        data["data"] = objects;
      }

      data["stacktrace"] = error?.stack;

      if (message !== "") log(message, severity, data);
    };

    api.exceptionHandlers.reporters.push(consoleReporter);
  }
}
