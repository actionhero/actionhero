import * as path from "path";
import * as fs from "fs";
import { Api } from "./classes/api";

function requireRelative(klass: string, file: string) {
  let fullPath = path.join(
    process.cwd(),
    "node_modules",
    "actionhero",
    "classes",
    file
  );
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(__dirname, "classes", file);
  }

  exports[klass] = require(fullPath);
}

[
  { klass: "Process", file: "process" },
  { klass: "Action", file: "action" },
  { klass: "Task", file: "task" },
  { klass: "Initializer", file: "initializer" },
  { klass: "Server", file: "server" },
  { klass: "CLI", file: "cli" },
  { klass: "ActionProcessor", file: "actionProcessor" },
  { klass: "Connection", file: "connection" }
].forEach(({ klass, file }) => {
  requireRelative(klass, file);
});

let api: Api;
exports.api = api;
