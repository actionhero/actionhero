import * as fs from "fs";
import * as cluster from "cluster";
import { api, Initializer } from "../index";

/**
 * Pid and Pidfile.
 */
export class Pids extends Initializer {
  constructor() {
    super();
    this.name = "pids";
    this.loadPriority = 50;
    this.startPriority = 1;
  }

  async initialize() {
    api.pids = {};
    api.pids.pid = process.pid;
    api.pids.path = api.config.general.paths.pid[0]; // it would be silly to have more than one pid

    api.pids.sanitizeId = function() {
      let pidfile = String(api.id).trim();
      pidfile = pidfile.replace(new RegExp(":", "g"), "-");
      pidfile = pidfile.replace(new RegExp(" ", "g"), "_");

      return pidfile;
    };

    if (cluster.isMaster) {
      api.pids.title = "actionhero-" + api.pids.sanitizeId();
    } else {
      api.pids.title = api.pids.sanitizeId();
    }

    try {
      fs.mkdirSync(api.pids.path);
    } catch (e) {}

    api.pids.writePidFile = () => {
      fs.writeFileSync(
        api.pids.path + "/" + api.pids.title,
        api.pids.pid.toString(),
        "ascii"
      );
    };

    api.pids.clearPidFile = () => {
      try {
        fs.unlinkSync(api.pids.path + "/" + api.pids.title);
      } catch (error) {
        api.log("Unable to remove pidfile", "error", error);
      }
    };
  }

  async start() {
    api.pids.writePidFile();
    api.log(`pid: ${process.pid}`, "notice");
  }
}
