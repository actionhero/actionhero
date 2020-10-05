import { Process, specHelper } from "./../../src/index";

const actionhero = new Process();

describe("Action", () => {
  describe("swagger", () => {
    beforeAll(async () => {
      process.env.AUTOMATIC_ROUTES = "get";
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("returns the correct parts", async () => {
      const { paths, basePath, host } = await specHelper.runAction("swagger");
      expect(basePath).toBe("/api/");
      expect(host).toMatch(/localhost/);
      expect(Object.keys(paths).length).toEqual(7); // 7 actions
    });
  });
});
