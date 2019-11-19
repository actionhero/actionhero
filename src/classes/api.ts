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
    this.running = false;
    this.initialized = false;
    this.shuttingDown = false;
    this.bootTime = null;
  }
}
