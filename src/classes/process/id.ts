import { argv } from "optimist";
import * as cluster from "cluster";
import { getExternalIPAddress } from "./../../utils/getExternalIPAddress";

/**
 * I build this server's ID from the external IP address of this server and pid.
 */
function determineId() {
  let id = "";

  if (argv.title) {
    id = argv.title;
  } else if (process.env.ACTIONHERO_TITLE) {
    id = process.env.ACTIONHERO_TITLE;
  } else {
    let externalIP = getExternalIPAddress();
    if (!externalIP) {
      const message =
        " * Error fetching this hosts external IP address; setting id base to 'actionhero'";
      console.log(message);
      externalIP = "actionhero";
    }

    id = externalIP;
    if (cluster.isWorker) {
      id += ":" + process.pid;
    }
  }

  return id;
}

export const id = determineId();
