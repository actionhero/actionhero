import type { ActionheroLogLevel } from "../modules/log";

export type ExceptionReporter = (
  error: Error,
  type: string,
  name: string,
  objects?: any,
  severity?: ActionheroLogLevel
) => void;
