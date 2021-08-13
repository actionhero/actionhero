import { argv } from "optimist";
import * as cluster from "cluster";
import { config } from "./../..";
import { utils } from "./../../modules/utils";

/**
 * I build this server's ID from the external IP address of this server and pid.
 */
function determineId() {
  let id = "";

  if (argv.title) {
    id = argv.title;
  } else if (process.env.ACTIONHERO_TITLE) {
    id = process.env.ACTIONHERO_TITLE;
  } else if (process.env.JEST_WORKER_ID) {
    id = `test-server-${process.env.JEST_WORKER_ID || 0}`;
  } else if (!config || !config.get<string>("general", "id")) {
    let externalIP = utils.getExternalIPAddress();
    if (!externalIP) {
      externalIP = "actionhero";
    }

    id = externalIP;
    if (cluster.isWorker) {
      id += ":" + process.pid;
    }
  } else {
    id = config.get<string>("general", "id");
  }

  return id;
}

export const id = determineId();
