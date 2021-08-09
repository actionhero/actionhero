import { ActionHeroLogLevel } from "../modules/log";

export type ExceptionReporter = (
  error: Error,
  type: string,
  name: string,
  objects?: any,
  severity?: ActionHeroLogLevel
) => void;
