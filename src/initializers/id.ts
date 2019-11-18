import { argv } from "optimist";
import * as cluster from "cluster";
import { api, Initializer } from "../index";

/**
 * I build this server's ID.
 */
export class ID extends Initializer {
  constructor() {
    super();
    this.name = "id";
    this.loadPriority = 10;
    this.startPriority = 2;
  }

  async initialize() {
    if (argv.title) {
      api.id = argv.title;
    } else if (process.env.ACTIONHERO_TITLE) {
      api.id = process.env.ACTIONHERO_TITLE;
    } else if (!api.config.general.id) {
      let externalIP = api.utils.getExternalIPAddress();
      if (!externalIP) {
        const message =
          " * Error fetching this hosts external IP address; setting id base to 'actionhero'";
        try {
          api.log(message, "crit");
        } catch (e) {
          console.log(message);
        }
        externalIP = "actionhero";
      }

      api.id = externalIP;
      if (cluster.isWorker) {
        api.id += ":" + process.pid;
      }
    } else {
      api.id = api.config.general.id;
    }
  }

  async start() {
    api.log(`server ID: ${api.id}`, "notice");
  }
}
