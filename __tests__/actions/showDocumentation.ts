import { Process, specHelper } from "./../../src/index";

const actionhero = new Process();

describe("Action", () => {
  describe("showDocumentation", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("returns the correct parts", async () => {
      const { documentation, serverInformation } = await specHelper.runAction(
        "showDocumentation"
      );
      expect(Object.keys(documentation).length).toEqual(7); // 7 actions
      expect(serverInformation.serverName).toEqual("actionhero");
    });
  });
});
