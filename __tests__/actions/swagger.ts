import { Process, specHelper } from "./../../src/index";
import { Swagger } from "../../src/actions/swagger";

describe("Action: swagger", () => {
  const actionhero = new Process();
  beforeAll(async () => {
    process.env.AUTOMATIC_ROUTES = "get";
    await actionhero.start();
  });

  afterAll(async () => await actionhero.stop());

  test("returns the correct parts", async () => {
    const { paths, basePath, host } = await specHelper.runAction<Swagger>(
      "swagger"
    );
    expect(basePath).toBe("/api/");
    expect(host).toMatch(/localhost/);
    expect(Object.keys(paths).length).toEqual(9); // 9 actions
  });
});
