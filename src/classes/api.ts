import * as path from "path";
import { argv } from "optimist";
const packageJson = require(path.join(__dirname, "..", "..", "package.json"));

export class Api {
  running: boolean;
  initialized: boolean;
  shuttingDown: boolean;
  projectRoot: string;
  env: string;
  actionheroVersion: string | number;
  bootTime: number | null;
  commands: {
    initialize: Function;
    start: Function;
    stop: Function;
    restart: Function;
  };
  config: any;
  utils: any;
  log: Function;
  watchFileAndAct: Function;
  typescript: boolean;
  _startingParams: {
    [key: string]: any;
  };

  // this is left in as way for older methods to still extend the api object
  // going forward, all interfacaes should be exposed via export to be consumed directly
  [key: string]: any;

  constructor() {
    this.typescript = isTypescript();

    this.env = "development";

    if (argv.NODE_ENV) {
      this.env = argv.NODE_ENV;
    } else if (process.env.NODE_ENV) {
      this.env = process.env.NODE_ENV;
    }

    let projectRoot = process.cwd();
    if (process.env.project_root) {
      projectRoot = process.env.project_root;
    } else if (process.env.projectRoot) {
      projectRoot = process.env.projectRoot;
    } else if (process.env.PROJECT_ROOT) {
      projectRoot = process.env.PROJECT_ROOT;
    }

    this.running = false;
    this.initialized = false;
    this.shuttingDown = false;
    this.projectRoot = projectRoot;
    this.bootTime = null;

    this.actionheroVersion = packageJson.version;
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
