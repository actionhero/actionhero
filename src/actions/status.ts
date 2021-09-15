import { api, id, task, Action, actionheroVersion } from "./../index";
import { PackageJson } from "type-fest";
import * as path from "path";
import * as fs from "fs";

// These values are probably good starting points, but you should expect to tweak them for your application
const maxMemoryAlloted = process.env.maxMemoryAlloted || 500;
const maxResqueQueueLength = process.env.maxResqueQueueLength || 1000;

enum StatusMessages {
  healthy = "Node Healthy",
  unhealthy = "Node Unhealthy",
}

const packageJSON: PackageJson = JSON.parse(
  fs
    .readFileSync(
      path.normalize(path.join(__dirname, "..", "..", "package.json"))
    )
    .toString()
);

export class Status extends Action {
  constructor() {
    super();
    this.name = "status";
    this.description = "I will return some basic information about the API";
    this.outputExample = {
      id: "192.168.2.11",
      actionheroVersion: "9.4.1",
      uptime: 10469,
    };
  }

  async run() {
    let nodeStatus = StatusMessages.healthy;
    const problems: string[] = [];

    const consumedMemoryMB =
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
    if (consumedMemoryMB > maxMemoryAlloted) {
      nodeStatus = StatusMessages.unhealthy;
      problems.push(`Using more than ${maxMemoryAlloted} MB of RAM/HEAP`);
    }

    let resqueTotalQueueLength = 0;
    const details = await task.details();
    let length = 0;
    Object.keys(details.queues).forEach((q) => {
      length += details.queues[q].length;
    });
    resqueTotalQueueLength = length;

    if (length > maxResqueQueueLength) {
      nodeStatus = StatusMessages.unhealthy;
      problems.push(`Resque Queues over ${maxResqueQueueLength} jobs`);
    }

    return {
      id: id,
      actionheroVersion: actionheroVersion,
      name: packageJSON.name as string,
      description: packageJSON.description as string,
      version: packageJSON.version as string,
      uptime: new Date().getTime() - api.bootTime,
      consumedMemoryMB,
      resqueTotalQueueLength,
      nodeStatus,
      problems,
    };
  }
}
