process.env.AUTOMATIC_ROUTES = "get";

import axios from "axios";
import * as fs from "fs";
import { Process, config } from "./../../src/index";

const actionhero = new Process();
let url: string;

describe("Server: sendFile", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web!.port;
  });

  afterAll(async () => await actionhero.stop());

  test("Server should sendFile", async () => {
    const stats = fs.statSync(__dirname + "/../../public/logo/actionhero.png");
    const response = await axios.get(url + "/api/sendFile");
    expect(stats.size).toBeGreaterThanOrEqual(response.data.length);
    expect(response.data).toContain("PNG");
  });
});
