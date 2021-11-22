process.env.AUTOMATIC_ROUTES = "get";

import { Process, specHelper, config } from "./../../src/index";
import { Swagger } from "../../src/actions/swagger";

describe("Action: swagger", () => {
  const actionhero = new Process();

  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("automatic routes is enabled", () => {
    expect(config.web.automaticRoutes).toEqual(["get"]);
  });

  test("returns the correct parts", async () => {
    const { paths, basePath, host } = await specHelper.runAction<Swagger>(
      "swagger"
    );

    expect(basePath).toBe("/api/");
    expect(host).toMatch(/localhost/);
    expect(Object.keys(paths).length).toEqual(9); // 9 actions
  });
});
