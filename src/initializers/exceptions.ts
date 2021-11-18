import { api, config, log, Initializer, Action } from "../index";
import { ExceptionReporter } from "../classes/exceptionReporter";
import { ParsedJob } from "node-resque";
import { ActionheroLogLevel } from "../modules/log";

export interface ExceptionHandlerAPI {
  reporters: Array<ExceptionReporter>;
  report: ExceptionsInitializer["report"];
  initializer: ExceptionsInitializer["initializer"];
  action: ExceptionsInitializer["action"];
  task: ExceptionsInitializer["task"];
}

/**
 * Handlers for when things go wrong.
 */
export class ExceptionsInitializer extends Initializer {
  constructor() {
    super();
    this.name = "exceptions";
    this.loadPriority = 1;
  }

  report = (
    error: NodeJS.ErrnoException,
    type: string,
    name: string,
    objects?: any,
    severity?: ActionheroLogLevel
  ) => {
    if (!severity) severity = "error";

    for (const reporter of api.exceptionHandlers.reporters) {
      reporter(error, type, name, objects, severity);
    }
  };

  initializer = (error: NodeJS.ErrnoException, fullFilePath: string) => {
    const name = "initializer:" + fullFilePath;
    api.exceptionHandlers.report(
      error,
      "initializer",
      name,
      { fullFilePath: fullFilePath },
      "alert"
    );
  };

  action = (
    error: NodeJS.ErrnoException,
    {
      to,
      action,
      params,
      duration,
      response,
    }: {
      to: string;
      action: Action["name"];
      params: string;
      duration: number;
      response: string;
    }
  ) => {
    api.exceptionHandlers.report(
      error,
      "action",
      `action: ${action}`,
      { to, action, params, duration, error, response },
      "alert"
    );
  };

  task = (
    error: NodeJS.ErrnoException,
    queue: string,
    task: ParsedJob,
    workerId: string | number
  ) => {
    let simpleName;
    try {
      simpleName = task["class"];
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

  async initialize() {
    api.exceptionHandlers = {
      reporters: [],
      report: this.report,
      initializer: this.initializer,
      action: this.action,
      task: this.task,
    };

    api.exceptionHandlers.reporters.push(consoleReporter);
  }
}

const consoleReporter: ExceptionReporter = (
  error: NodeJS.ErrnoException & { [key: string]: any },
  type,
  name,
  objects,
  severity
) => {
  let message = "";
  const data = error["data"] ?? {};

  if (type === "uncaught") {
    message = `Uncaught ${name}`;
  } else if (type === "action") {
    // no need to log anything, it was handled already by the actionProcessor
  } else if (type === "initializer") {
    message = `Error from Initializer`;
  } else if (type === "task") {
    message = `Error from Task`;
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

  if (error["stack"]) {
    data["stack"] = error.stack;
  } else {
    data["stack"] = error.message ?? error.toString();
  }

  try {
    if (message) log(message, severity, data);
  } catch (e) {
    console.log(message, data);
  }
};
