import * as path from "path";

function isTypescript(): boolean {
  const extension = path.extname(__filename);
  if (extension === ".ts") {
    return true;
  }

  try {
    /**
     * Are we running in typescript at the moment?
     * see https://github.com/TypeStrong/ts-node/pull/858 for more details
     */
    return process[Symbol.for("ts-node.register.instance")] ||
      (process.env.NODE_ENV === "test" &&
        process.env.ACTIONHERO_TEST_FILE_EXTENSION !== "js")
      ? true
      : false;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export const typescript = isTypescript();
