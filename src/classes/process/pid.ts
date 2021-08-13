import * as fs from "fs";
import { log } from "../../modules/log";
import { config } from "./../..";
import { id } from "./id";

function sanitizeId() {
  let pidfile = String(id).trim();
  pidfile = pidfile.replace(new RegExp(":", "g"), "-");
  pidfile = pidfile.replace(new RegExp(" ", "g"), "_");

  return pidfile;
}

export const pid = process.pid;
const pidPaths = config.get<string[]>("general", "paths", "pid");
const path = pidPaths[0]; // it would be silly to have more than one pidfile
let title = `actionhero-${sanitizeId()}`;

try {
  fs.mkdirSync(path);
} catch (e) {}

export function writePidFile() {
  log(`pid: ${process.pid}`, "notice");
  fs.writeFileSync(path + "/" + title, pid.toString(), "ascii");
}

export function clearPidFile() {
  try {
    fs.unlinkSync(path + "/" + title);
  } catch (error) {
    log("Unable to remove pidfile", "error", error);
  }
}
