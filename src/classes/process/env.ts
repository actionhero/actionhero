import { utils } from "../../modules/utils";

function determineNodeEnv(): string {
  let env = "development";

  if (utils.argv.NODE_ENV) {
    env = utils.argv.NODE_ENV.toString();
  } else if (process.env.NODE_ENV) {
    env = process.env.NODE_ENV;
  }

  return env;
}

export const env = determineNodeEnv();
