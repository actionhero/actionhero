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
  _startingParams: {
    [key: string]: any;
  };
  [key: string]: any;
}
