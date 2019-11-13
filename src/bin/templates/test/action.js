const { Process } = require("actionhero");
const actionhero = new Process();
let api;

describe("Action", () => {
  describe("%%name%%", () => {
    beforeAll(async () => {
      api = await actionhero.start();
    });
    afterAll(async () => {
      await actionhero.stop();
    });

    test("returns OK", async () => {
      const { ok } = await api.specHelper.runAction("%%name%%");
      expect(ok).toEqual(true);
    });
  });
});
