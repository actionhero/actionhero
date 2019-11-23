import { argv } from "optimist";

function determineNodeEnv(): string {
  let env = "development";

  if (argv.NODE_ENV) {
    env = argv.NODE_ENV;
  } else if (process.env.NODE_ENV) {
    env = process.env.NODE_ENV;
  }

  return env;
}

export const env = determineNodeEnv();
