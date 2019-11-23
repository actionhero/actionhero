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
      }
    };

    const consoleReporter = (error, type, name, objects, severity) => {
      const extraMessages = [];

      if (type === "loader") {
        extraMessages.push("! Failed to load " + objects.fullFilePath);
      } else if (type === "action") {
        extraMessages.push("! uncaught error from action: " + name);
        extraMessages.push("! connection details:");
        const relevantDetails = this.relevantDetails();
        for (const i in relevantDetails) {
          const relevantDetail = relevantDetails[i];
          if (
            objects.connection[relevantDetail] !== null &&
            objects.connection[relevantDetail] !== undefined &&
            typeof objects.connection[relevantDetail] !== "function"
          ) {
            extraMessages.push(
              "!     " +
                relevantDetail +
                ": " +
                JSON.stringify(objects.connection[relevantDetail])
            );
          }
        }
      } else if (type === "task") {
        extraMessages.push(
          "! error from task: " +
            name +
            " on queue " +
            objects.queue +
            " (worker #" +
            objects.workerId +
            ")"
        );
        try {
          extraMessages.push(
            "!     arguments: " + JSON.stringify(objects.task.args)
          );
        } catch (e) {}
      } else {
        extraMessages.push("! Error: " + error.message);
        extraMessages.push("!     Type: " + type);
        extraMessages.push("!     Name: " + name);
        extraMessages.push("!     Data: " + JSON.stringify(objects));
      }

      for (const m in extraMessages) {
        log(extraMessages[m], severity);
      }
      let lines;
      try {
        lines = error.stack.split(os.EOL);
      } catch (e) {
        lines = new Error(error).stack.split(os.EOL);
      }
      for (const l in lines) {
        const line = lines[l];
        log("! " + line, severity);
      }
      log("*", severity);
    };

    api.exceptionHandlers.reporters.push(consoleReporter);

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

    api.exceptionHandlers.action = (error, data, next) => {
      let simpleName;
      try {
        simpleName = data.action;
      } catch (e) {
        simpleName = error.message;
      }
      const name = "action:" + simpleName;
      api.exceptionHandlers.report(
        error,
        "action",
        name,
        { connection: data.connection },
        "error"
      );
      data.connection.response = {}; // no partial responses
      if (typeof next === "function") {
        next();
      }
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
  }
}
