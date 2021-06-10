export type ExceptionReporter = (
  error: Error,
  type: string,
  name: string,
  objects?: any,
  severity?: string
) => void;
