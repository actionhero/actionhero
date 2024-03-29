import * as cluster from "cluster";
import { config } from "./../../modules/config";
import { utils } from "../../modules/utils";

/**
 * I build this server's ID from the external IP address of this server and pid.
 */
function determineId() {
  let id = "";

  if (utils.argv.title) {
    id = utils.argv.title.toString();
  } else if (process.env.ACTIONHERO_TITLE) {
    id = process.env.ACTIONHERO_TITLE;
  } else if (process.env.JEST_WORKER_ID) {
    id = `test-server-${process.env.JEST_WORKER_ID || 0}`;
  } else if (!config || !config.general.id) {
    let externalIP = utils.getExternalIPAddress();
    if (!externalIP) {
      externalIP = "actionhero";
    }

    id = externalIP;
    // @ts-ignore - we need to load * as for node v16 support
    if (cluster["isWorker"]) id += `:${process.pid}`;
  } else {
    id = config.general.id;
  }

  return id;
}

export let id = determineId();
export const recalcuateId = () => (id = determineId());
