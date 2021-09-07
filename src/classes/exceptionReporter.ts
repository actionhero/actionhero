import type { LogLevels } from "../modules/log";

export type ExceptionReporter = (
  error: Error,
  type: string,
  name: string,
  objects?: any,
  severity?: LogLevels
) => void;
