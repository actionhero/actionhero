import * as path from "path";

function isTypescript(): boolean {
  // do we have any flags?
  if (process.env.ACTIONHERO_TYPESCRIPT_MODE?.length > 0) {
    return process.env.ACTIONHERO_TYPESCRIPT_MODE.toLowerCase() === "true"
      ? true
      : false;
  }

  // if this file is typescript, we are running typescript :D
  // this is the best check, but fails when actionhero is compiled to js though...
  const extension = path.extname(__filename);
  if (extension === ".ts") {
    return true;
  }

  // are we running via a ts-node/ts-node-dev shim?
  const lastArg = process.execArgv[process.execArgv.length - 1];
  if (lastArg && path.parse(lastArg).name.indexOf("ts-node") >= 0) {
    return true;
  }

  try {
    /**
     * Are we running in typescript at the moment?
     * see https://github.com/TypeStrong/ts-node/pull/858 for more details
     */

    // @ts-ignore
    return process[Symbol.for("ts-node.register.instance")] ||
      (process.env.NODE_ENV === "test" &&
        process.env.ACTIONHERO_TYPESCRIPT_MODE?.toLowerCase() !== "false")
      ? true
      : false;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export const typescript = isTypescript();
