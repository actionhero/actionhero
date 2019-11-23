import { Process, config, specHelper } from "./../../src/index";

const actionhero = new Process();
let api;
let originalUnknownAction;
let originalGenericError;

describe("Core", () => {
  describe("errors", () => {
    beforeAll(async () => {
      api = await actionhero.start();
      originalUnknownAction = config.errors.unknownAction;
    });

    afterAll(async () => {
      await actionhero.stop();
      config.errors.unknownAction = originalUnknownAction;
    });

    test("returns string errors properly", async () => {
      const { error } = await specHelper.runAction("notARealAction");
      expect(error).toEqual("Error: unknown action or invalid apiVersion");
    });

    test("returns Error object properly", async () => {
      config.errors.unknownAction = () => {
        return new Error("error test");
      };
      const { error } = await specHelper.runAction("notARealAction");
      expect(error).toEqual("Error: error test");
    });

    test("returns generic object properly", async () => {
      config.errors.unknownAction = () => {
        return { code: "error111", reason: "busted" };
      };

      const { error } = await specHelper.runAction("notARealAction");
      expect(error.code).toEqual("error111");
      expect(error.reason).toEqual("busted");
    });

    test("can have async error handlers", async () => {
      config.errors.unknownAction = async () => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ sleepy: true });
          }, 100);
        });
      };

      const { error } = await specHelper.runAction("notARealAction");
      expect(error.sleepy).toEqual(true);
    });
  });

  describe("Core: Errors: Custom Error Decoration", () => {
    const errorMsg = "worst action ever!";
    beforeAll(async () => {
      api = await actionhero.start();
      originalGenericError = config.errors.genericError;
      api.actions.versions.errorAction = [1];
      api.actions.actions.errorAction = {
        1: {
          name: "errorAction",
          description: "this action throws errors",
          version: 1,
          inputs: {},
          run: async data => {
            throw new Error(errorMsg);
          }
        }
      };
    });

    afterAll(async () => {
      await actionhero.stop();
      delete api.actions.actions.errorAction;
      delete api.actions.versions.errorAction;
      config.errors.genericError = originalGenericError;
    });

    test("will return an actions error", async () => {
      const response = await specHelper.runAction("errorAction");
      expect(response.error).toEqual("Error: worst action ever!");
      expect(response.requestId).toBeUndefined();
    });

    test("can decorate an error", async () => {
      config.errors.genericError = async (data, error) => {
        data.response.requestId = "id-12345";
        return error;
      };
      const response = await specHelper.runAction("errorAction");
      expect(response.error).toEqual("Error: worst action ever!");
      expect(response.requestId).toEqual("id-12345");
    });
  });
});
