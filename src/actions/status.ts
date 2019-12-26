import { api, id, task, Action, actionheroVersion } from "./../index";
import * as path from "path";
const packageJSON = require(path.normalize(
  path.join(__dirname, "..", "..", "package.json")
));

// These values are probably good starting points, but you should expect to tweak them for your application
const maxEventLoopDelay = process.env.eventLoopDelay || 10;
const maxMemoryAlloted = process.env.maxMemoryAlloted || 500;
const maxResqueQueueLength = process.env.maxResqueQueueLength || 1000;

module.exports = class Status extends Action {
  constructor() {
    super();
    this.name = "status";
    this.description = "I will return some basic information about the API";
    this.outputExample = {
      id: "192.168.2.11",
      actionheroVersion: "9.4.1",
      uptime: 10469
    };
  }

  async checkRam(data) {
    const consumedMemoryMB =
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
    data.response.consumedMemoryMB = consumedMemoryMB;
    if (consumedMemoryMB > maxMemoryAlloted) {
      data.response.nodeStatus = data.connection.localize("Unhealthy");
      data.response.problems.push(
        data.connection.localize([
          "Using more than {{maxMemoryAlloted}} MB of RAM/HEAP",
          { maxMemoryAlloted: maxMemoryAlloted }
        ])
      );
    }
  }

  async checkResqueQueues(data) {
    const details = await task.details();
    let length = 0;
    Object.keys(details.queues).forEach(q => {
      length += details.queues[q].length;
    });

    data.response.resqueTotalQueueLength = length;

    if (length > maxResqueQueueLength) {
      data.response.nodeStatus = data.connection.localize("Node Unhealthy");
      data.response.problems.push(
        data.connection.localize([
          "Resque Queues over {{maxResqueQueueLength}} jobs",
          { maxResqueQueueLength: maxResqueQueueLength }
        ])
      );
    }
  }

  async run(data) {
    data.response.uptime = new Date().getTime() - api.bootTime;
    data.response.nodeStatus = data.connection.localize("Node Healthy");
    data.response.problems = [];

    data.response.id = id;
    data.response.actionheroVersion = actionheroVersion;
    data.response.name = packageJSON.name;
    data.response.description = packageJSON.description;
    data.response.version = packageJSON.version;

    await this.checkRam(data);
    await this.checkResqueQueues(data);
  }
};
