/**
 * Are we running in typescript at the moment?
 * see https://github.com/TypeStrong/ts-node/pull/858 for more details
 */
function isTypescript(): boolean {
  try {
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
