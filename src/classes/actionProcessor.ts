import { Connection } from "./connection";
import { Action } from "./action";
import { config } from "./../modules/config";
import { log } from "../modules/log";
import { utils } from "../modules/utils";
import * as dotProp from "dot-prop";
import { api } from "../index";
import { stat } from "fs";

export type ErrorStatusMessage =
  | "complete"
  | "generic_error"
  | "server_shutting_down"
  | "too_many_requests"
  | "unknown_action"
  | "unsupported_server_type"
  | "missing_params"
  | "validator_errors";

export class ActionProcessor<ActionClass extends Action> {
  connection: Connection;
  action: ActionClass["name"];
  toProcess: boolean;
  toRender: boolean;
  messageId: number | string;
  params: {
    action: string;
    apiVersion: string | number;
    [key: string]: any;
  };
  // params: ActionClass["inputs"];
  missingParams: Array<string>;
  validatorErrors: Array<string | Error>;
  actionStartTime: number;
  actionTemplate: ActionClass;
  working: boolean;
  response: {
    [key: string]: any;
  };
  duration: number;
  actionStatus: ErrorStatusMessage;

  // allow for setting of any value via middleware
  session: any;

  constructor(connection: Connection) {
    this.connection = connection;
    this.action = null;
    this.toProcess = true;
    this.toRender = true;
    this.messageId = connection.messageId || 0;
    this.params = Object.assign(
      { action: null, apiVersion: null },
      connection.params
    );
    this.missingParams = [];
    this.validatorErrors = [];
    this.actionStartTime = null;
    this.actionTemplate = null;
    this.working = false;
    this.response = {};
    this.duration = null;
    this.actionStatus = null;
    this.session = {};
  }

  private incrementTotalActions(count = 1) {
    this.connection.totalActions = this.connection.totalActions + count;
  }

  private incrementPendingActions(count = 1) {
    this.connection.pendingActions = this.connection.pendingActions + count;
    if (this.connection.pendingActions < 0) {
      this.connection.pendingActions = 0;
    }
  }

  getPendingActionCount() {
    return this.connection.pendingActions;
  }

  private async completeAction(status: ErrorStatusMessage, _error?: Error) {
    let error: Error = null;
    this.actionStatus = status;

    if (status === "generic_error") {
      error =
        typeof config.errors.genericError === "function"
          ? await config.errors.genericError(this, _error)
          : _error;
    } else if (status === "server_shutting_down") {
      error = await config.errors.serverShuttingDown(this);
    } else if (status === "too_many_requests") {
      error = await config.errors.tooManyPendingActions(this);
    } else if (status === "unknown_action") {
      error = await config.errors.unknownAction(this);
    } else if (status === "unsupported_server_type") {
      error = await config.errors.unsupportedServerType(this);
    } else if (status === "missing_params") {
      error = await config.errors.missingParams(this, this.missingParams);
    } else if (status === "validator_errors") {
      error = await config.errors.invalidParams(this, this.validatorErrors);
    } else if (status) {
      error = _error;
    }

    if (typeof error === "string") error = new Error(error);

    if (error && (typeof this.response === "string" || !this.response.error)) {
      if (typeof this.response === "string" || Array.isArray(this.response)) {
        //@ts-ignore
        this.response = error.toString();
      } else {
        this.response.error = error;
      }
    }

    this.incrementPendingActions(-1);
    this.duration = new Date().getTime() - this.actionStartTime;
    this.working = false;
    this.logAndReportAction(status, error);

    return this;
  }

  private logAndReportAction(status: ErrorStatusMessage, error: Error) {
    const { type, rawConnection } = this.connection;

    let logLevel = "info";
    if (this.actionTemplate && this.actionTemplate.logLevel) {
      logLevel = this.actionTemplate.logLevel;
    }

    const filteredParams = utils.filterObjectForLogging(this.params);
    let logLine = {
      to: this.connection.remoteIP,
      action: this.action,
      params: JSON.stringify(filteredParams),
      duration: this.duration,
      error: "",
      method: type === "web" ? rawConnection.method : undefined,
      pathname: type === "web" ? rawConnection.parsedURL.pathname : undefined,
      response: undefined,
    };

    if (config.general.enableResponseLogging) {
      logLine.response = JSON.stringify(
        utils.filterResponseForLogging(this.response)
      );
    }

    if (error) {
      let errorFields;
      const formatErrorLogLine =
        config.errors.serializers.actionProcessor ||
        this.applyDefaultErrorLogLineFormat;
      ({ logLevel = "error", errorFields } = formatErrorLogLine(error));
      logLine = { ...logLine, ...errorFields };
    }

    log(`[ action @ ${this.connection.type} ]`, logLevel, logLine);

    if (error && status !== "unknown_action") {
      api.exceptionHandlers.action(error, logLine);
    }
  }

  private applyDefaultErrorLogLineFormat(error: Error) {
    const errorFields: { error: string } = { error: null };
    if (error instanceof Error) {
      errorFields.error = error.toString();
      Object.getOwnPropertyNames(error)
        .filter((prop) => prop !== "message")
        .sort((a, b) => (a === "stack" || b === "stack" ? -1 : 1))
        .forEach((prop) => (errorFields[prop] = error[prop]));
    } else {
      try {
        errorFields.error = JSON.stringify(error);
      } catch (e) {
        errorFields.error = String(error);
      }
    }

    return { errorFields };
  }

  private async preProcessAction() {
    const processorNames = api.actions.globalMiddleware.slice(0);

    if (this.actionTemplate.middleware) {
      this.actionTemplate.middleware.forEach(function (m) {
        processorNames.push(m);
      });
    }

    for (const i in processorNames) {
      const name = processorNames[i];
      if (typeof api.actions.middleware[name].preProcessor === "function") {
        await api.actions.middleware[name].preProcessor(this);
      }
    }
  }

  private async postProcessAction() {
    const processorNames = api.actions.globalMiddleware.slice(0);

    if (this.actionTemplate.middleware) {
      this.actionTemplate.middleware.forEach((m) => {
        processorNames.push(m);
      });
    }

    for (const i in processorNames) {
      const name = processorNames[i];
      if (typeof api.actions.middleware[name].postProcessor === "function") {
        await api.actions.middleware[name].postProcessor(this);
      }
    }
  }

  private reduceParams(schemaKey?: string) {
    let inputs = this.actionTemplate.inputs || {};
    let params = this.params;

    if (schemaKey) {
      inputs = this.actionTemplate.inputs[schemaKey].schema;
      params = this.params[schemaKey];
    }

    const inputNames = Object.keys(inputs) || [];
    if (config.general.disableParamScrubbing !== true) {
      for (const p in params) {
        if (
          api.params.globalSafeParams.indexOf(p) < 0 &&
          inputNames.indexOf(p) < 0
        ) {
          delete params[p];
        }
      }
    }
  }

  private prepareStringMethod(method: string): Function {
    const cmdParts = method.split(".");
    const cmd = cmdParts.shift();
    if (cmd !== "api") {
      throw new Error("cannot operate on a method outside of the api object");
    }
    return dotProp.get(api, cmdParts.join("."));
  }

  private async validateParam(props, params, key, schemaKey) {
    // default
    if (params[key] === undefined && props.default !== undefined) {
      if (typeof props.default === "function") {
        params[key] = await props.default.call(api, params[key], this);
      } else {
        params[key] = props.default;
      }
    }

    // formatter
    if (params[key] !== undefined && props.formatter !== undefined) {
      if (!Array.isArray(props.formatter)) {
        props.formatter = [props.formatter];
      }

      for (const i in props.formatter) {
        const formatter = props.formatter[i];
        if (typeof formatter === "function") {
          params[key] = await formatter.call(api, params[key], this);
        } else {
          const method = this.prepareStringMethod(formatter);
          params[key] = await method.call(api, params[key], this);
        }
      }
    }

    // validator
    if (params[key] !== undefined && props.validator !== undefined) {
      if (!Array.isArray(props.validator)) {
        props.validator = [props.validator];
      }

      for (const j in props.validator) {
        const validator = props.validator[j];
        let validatorResponse;
        try {
          if (typeof validator === "function") {
            validatorResponse = await validator.call(api, params[key], this);
          } else {
            const method = this.prepareStringMethod(validator);
            validatorResponse = await method.call(api, params[key], this);
          }

          // validator function returned nothing; assume param is OK
          if (validatorResponse === null || validatorResponse === undefined) {
            return;
          }

          // validator returned something that was not `true`
          if (validatorResponse !== true) {
            if (validatorResponse === false) {
              this.validatorErrors.push(
                new Error(`Input for parameter "${key}" failed validation!`)
              );
            } else {
              this.validatorErrors.push(validatorResponse);
            }
          }
        } catch (error) {
          // validator threw an error
          this.validatorErrors.push(error);
        }
      }
    }

    // required
    if (props.required === true) {
      if (config.general.missingParamChecks.indexOf(params[key]) >= 0) {
        let missingKey = key;
        if (schemaKey) {
          missingKey = `${schemaKey}.${missingKey}`;
        }
        this.missingParams.push(missingKey);
      }
    }
  }

  private async validateParams(schemaKey?: string) {
    let inputs = this.actionTemplate.inputs || {};
    let params = this.params;

    if (schemaKey) {
      inputs = this.actionTemplate.inputs[schemaKey].schema;
      params = this.params[schemaKey];
    }

    for (const key in inputs) {
      const props = inputs[key];
      await this.validateParam(props, params, key, schemaKey);

      if (props.schema && params[key]) {
        this.reduceParams(key);
        await this.validateParams(key);
      }
    }
  }

  lockParams() {
    this.params = Object.freeze(this.params);
  }

  async processAction(
    actionName?: string,
    apiVersion = this.params.apiVersion
  ) {
    this.actionStartTime = new Date().getTime();
    this.working = true;
    this.incrementTotalActions();
    this.incrementPendingActions();
    this.action = actionName || this.params.action;

    if (api.actions.versions[this.action]) {
      if (!apiVersion) {
        apiVersion =
          api.actions.versions[this.action][
            api.actions.versions[this.action].length - 1
          ];
      }

      //@ts-ignore
      this.actionTemplate = api.actions.actions[this.action][apiVersion];

      // send back the version we use to send in the api response
      if (!this.params.apiVersion) this.params.apiVersion = apiVersion;
    }

    if (api.running !== true) {
      return this.completeAction("server_shutting_down");
    }

    if (this.getPendingActionCount() > config.general.simultaneousActions) {
      return this.completeAction("too_many_requests");
    }

    if (!this.action || !this.actionTemplate) {
      return this.completeAction("unknown_action");
    }

    if (
      this.actionTemplate.blockedConnectionTypes &&
      this.actionTemplate.blockedConnectionTypes.indexOf(
        this.connection.type
      ) >= 0
    ) {
      return this.completeAction("unsupported_server_type");
    }

    return this.runAction();
  }

  private async runAction() {
    try {
      const preProcessResponse = await this.preProcessAction();
      if (preProcessResponse !== undefined && preProcessResponse !== null) {
        Object.assign(this.response, preProcessResponse);
      }

      await this.reduceParams();
      await this.validateParams();
      this.lockParams();
    } catch (error) {
      return this.completeAction("generic_error", error);
    }

    if (this.missingParams.length > 0) {
      return this.completeAction("missing_params");
    }

    if (this.validatorErrors.length > 0) {
      return this.completeAction("validator_errors");
    }

    if (this.toProcess === true) {
      try {
        const actionResponse = await this.actionTemplate.run(this);
        if (actionResponse !== undefined && actionResponse !== null) {
          Object.assign(this.response, actionResponse);
        }

        const postProcessResponse = await this.postProcessAction();
        if (postProcessResponse !== undefined && postProcessResponse !== null) {
          Object.assign(this.response, postProcessResponse);
        }

        return this.completeAction("complete");
      } catch (error) {
        return this.completeAction("generic_error", error);
      }
    } else {
      return this.completeAction("complete");
    }
  }
}
