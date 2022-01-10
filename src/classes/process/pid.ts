import * as fs from "fs";
import { log } from "../../modules/log";
import { config } from "./../../modules/config";
import { id } from "./id";

function sanitizeId() {
  let pidfile = String(id).trim();
  pidfile = pidfile.replace(new RegExp(":", "g"), "-");
  pidfile = pidfile.replace(new RegExp(" ", "g"), "_");

  return pidfile;
}

const path = config.general.paths.pid[0]; // it would be silly to have more than one pid
let title = `actionhero-${sanitizeId()}`;

try {
  fs.mkdirSync(path);
} catch (e) {}

export function writePidFile() {
  log(`pid: ${process.pid}`, "notice");
  fs.writeFileSync(path + "/" + title, process.pid.toString(), "ascii");
}

export function clearPidFile() {
  try {
    fs.unlinkSync(path + "/" + title);
  } catch (error) {
    log("Unable to remove pidfile", "error", error);
  }
}
