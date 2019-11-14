export class Api {
  running: boolean;
  initialized: boolean;
  shuttingDown: boolean;
  projectRoot: string;
  actionheroVersion: string | number;
  bootTime: number | null;
  commands: {
    initialize: Function;
    start: Function;
    stop: Function;
    restart: Function;
  };
  config: any;
  // utils: {
  //   [key: string]:
  //     | Function
  //     | {
  //         [key: string]: Function;
  //       };
  // };
  utils: any;
  log: Function;
  watchFileAndAct: Function;
  typescript: boolean;
  ext: string;
  _startingParams: {
    [key: string]: any;
  };
  [key: string]: any;

  constructor() {
    this.typescript = isTypescript();
    this.ext = this.typescript ? ".ts" : ".js";
  }
}

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
