process.env.AUTOMATIC_ROUTES = "get";

import * as request from "request-promise-native";
import * as fs from "fs";
import { Process, config } from "./../../src/index";

const actionhero = new Process();
let url: string;

describe("Server: sendFile", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web.port;
  });

  afterAll(async () => await actionhero.stop());

  test("Server should sendFile", async () => {
    const stats = fs.statSync(__dirname + "/../../public/logo/actionhero.png");
    const body = await request.get(url + "/api/sendFile");
    expect(stats.size).toBeGreaterThanOrEqual(body.length);
    expect(body).toContain("PNG");
  });
});
