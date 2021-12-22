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
  if (extension === ".ts") return true;

  // is the script that was executed a TS script? Check for a *.ts filename somewhere in the process arguments
  for (const arg of process.argv) {
    if (arg.match(/.+\.ts$/)) return true;
  }

  // are we running via ts-jest?
  if (process.env.TS_JEST) return true;

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
    if (process[Symbol.for("ts-node.register.instance")]) return true;
  } catch (error) {
    console.error(error);
    return false;
  }

  // We didn't find a reason to suspect we are running TS, so return false
  return false;
}

export const typescript = isTypescript();
