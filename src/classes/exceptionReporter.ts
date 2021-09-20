import type { ActionheroLogLevel } from "../modules/log";

export type ExceptionReporter = (
  error: NodeJS.ErrnoException,
  type: string,
  name: string,
  objects?: any,
  severity?: ActionheroLogLevel
) => void;
