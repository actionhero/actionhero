import { config, Process, Action, specHelper } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Core", () => {
  describe("api", () => {
    beforeAll(async () => {
      api = await actionhero.start();
    });
    afterAll(async () => {
      await actionhero.stop();
    });

    test("should have an api object with proper parts", () => {
      [
        api.actions.actions,
        api.actions.versions,
        api.actions.actions.cacheTest["1"],
        api.actions.actions.randomNumber["1"],
        api.actions.actions.status["1"]
      ].forEach(item => {
        expect(item).toBeInstanceOf(Object);
      });

      [
        api.actions.actions.cacheTest["1"].run,
        api.actions.actions.randomNumber["1"].run,
        api.actions.actions.status["1"].run
      ].forEach(item => {
        expect(item).toBeInstanceOf(Function);
      });

      [
        api.actions.actions.randomNumber["1"].name,
        api.actions.actions.randomNumber["1"].description
      ].forEach(item => {
        expect(typeof item).toEqual("string");
      });

      expect(config).toBeInstanceOf(Object);
    });

    test("should have loaded postVariables properly", () => {
      [
        "file",
        "callback",
        "action",
        "apiVersion",
        "key", // from cacheTest action
        "value" // from cacheTest action
      ].forEach(item => {
        expect(api.params.postVariables.indexOf(item) >= 0).toEqual(true);
      });
    });

    describe("api versions", () => {
      beforeAll(() => {
        api.actions.versions.versionedAction = [1, 2, 3];
        api.actions.actions.versionedAction = {
          1: {
            name: "versionedAction",
            description: "I am a test",
            version: 1,
            outputExample: {},
            run: async data => {
              data.response.version = 1;
            }
          },
          2: {
            name: "versionedAction",
            description: "I am a test",
            version: 2,
            outputExample: {},
            run: async data => {
              data.response.version = 2;
            }
          },
          3: {
            name: "versionedAction",
            description: "I am a test",
            version: 3,
            outputExample: {},
            run: async data => {
              data.response.version = 3;
              data.response.error = {
                a: { complex: "error" }
              };
            }
          }
        };
      });

      afterAll(() => {
        delete api.actions.actions.versionedAction;
        delete api.actions.versions.versionedAction;
      });

      test("will default actions to version 1 when no version is provided by the definition", async () => {
        const response = await specHelper.runAction("randomNumber");
        expect(response.requesterInformation.receivedParams.apiVersion).toEqual(
          1
        );
      });

      test("can specify an apiVersion", async () => {
        let response;
        response = await specHelper.runAction("versionedAction", {
          apiVersion: 1
        });
        expect(response.requesterInformation.receivedParams.apiVersion).toEqual(
          1
        );
        response = await specHelper.runAction("versionedAction", {
          apiVersion: 2
        });
        expect(response.requesterInformation.receivedParams.apiVersion).toEqual(
          2
        );
      });

      test("will default clients to the latest version of the action", async () => {
        const response = await specHelper.runAction("versionedAction");
        expect(response.requesterInformation.receivedParams.apiVersion).toEqual(
          3
        );
      });

      test("will fail on a missing action + version", async () => {
        const response = await specHelper.runAction("versionedAction", {
          apiVersion: 10
        });
        expect(response.error).toEqual(
          "Error: unknown action or invalid apiVersion"
        );
      });

      test("can return complex error responses", async () => {
        const response = await specHelper.runAction("versionedAction", {
          apiVersion: 3
        });
        expect(response.error.a.complex).toEqual("error");
      });
    });

    describe("action constructor", () => {
      test("validates actions", () => {
        class GoodAction extends Action {
          constructor() {
            super();
            this.name = "good";
            this.description = "good";
            this.outputExample = {};
          }

          async run() {}
        }

        class BadAction extends Action {
          constructor() {
            super();
            // this.name = 'bad'
            this.description = "bad";
            this.outputExample = {};
          }

          async run() {}
        }

        const goodAction = new GoodAction();
        const badAction = new BadAction();

        goodAction.validate();

        try {
          badAction.validate();
          throw new Error("should not get here");
        } catch (error) {
          expect(error.toString()).toMatch(/name is required for this action/);
        }
      });
    });

    describe("Action Params", () => {
      beforeAll(() => {
        api.actions.versions.testAction = [1];
        api.actions.actions.testAction = {
          1: {
            name: "testAction",
            description: "this action has some required params",
            version: 1,
            inputs: {
              requiredParam: { required: true },
              optionalParam: { required: false },
              fancyParam: {
                required: false,
                default: () => {
                  return "abc123";
                },
                validator: function(s) {
                  if (s !== "abc123") {
                    return 'fancyParam should be "abc123".  so says ' + this.id;
                  }
                },
                formatter: function(s) {
                  return String(s);
                }
              }
            },
            run: async data => {
              data.response.params = data.params;
            }
          }
        };
      });

      afterAll(() => {
        delete api.actions.actions.testAction;
        delete api.actions.versions.testAction;
        config.general.missingParamChecks = [null, "", undefined];
      });

      test("correct params that are falsey (false, []) should be allowed", async () => {
        let response;
        response = await specHelper.runAction("testAction", {
          requiredParam: false
        });
        expect(response.params.requiredParam).toEqual(false);
        response = await specHelper.runAction("testAction", {
          requiredParam: []
        });
        expect(response.params.requiredParam).toHaveLength(0);
      });

      test("will fail for missing or empty string params", async () => {
        let response = await specHelper.runAction("testAction", {
          requiredParam: ""
        });
        expect(response.error).toContain("required parameter for this action");
        response = await specHelper.runAction("testAction", {});
        expect(response.error).toMatch(
          /requiredParam is a required parameter for this action/
        );
      });

      test("correct params respect config options", async () => {
        let response;
        config.general.missingParamChecks = [undefined];
        response = await specHelper.runAction("testAction", {
          requiredParam: ""
        });
        expect(response.params.requiredParam).toEqual("");
        response = await specHelper.runAction("testAction", {
          requiredParam: null
        });
        expect(response.params.requiredParam).toBeNull();
      });

      test("will set a default when params are not provided", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true
        });
        expect(response.params.fancyParam).toEqual("abc123");
      });

      test("will use validator if provided", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true,
          fancyParam: 123
        });
        expect(response.error).toMatch(/Error: fancyParam should be "abc123"/);
      });

      test("validator will have the API object in scope as this", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true,
          fancyParam: 123
        });
        expect(response.error).toMatch(new RegExp(api.id));
      });

      test("will use formatter if provided (and still use validator)", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true,
          fancyParam: 123
        });
        expect(response.requesterInformation.receivedParams.fancyParam).toEqual(
          "123"
        );
      });

      test("succeeds a validator which returns no response", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true,
          fancyParam: "abc123"
        });
        expect(response.error).toBeUndefined();
      });

      test("will filter params not set in the target action or global safelist", async () => {
        const response = await specHelper.runAction("testAction", {
          requiredParam: true,
          sleepDuration: true
        });
        expect(
          response.requesterInformation.receivedParams.requiredParam
        ).toBeTruthy();
        expect(
          response.requesterInformation.receivedParams.sleepDuration
        ).toBeUndefined();
      });
    });

    describe("Action Params schema type", () => {
      beforeAll(() => {
        api.actions.versions.testAction = [1];
        api.actions.actions.testAction = {
          1: {
            name: "testAction",
            description: "this action has some required params",
            version: 1,
            inputs: {
              schemaParam: {
                schema: {
                  requiredParam: { required: true },
                  optionalParam: { required: false },
                  fancyParam: {
                    required: false,
                    default: () => {
                      return "abc123";
                    },
                    validator: function(s) {
                      if (s === "abc123") {
                        return true;
                      } else {
                        return (
                          'fancyParam should be "abc123".  so says ' + this.id
                        );
                      }
                    },
                    formatter: s => {
                      return String(s);
                    }
                  }
                }
              }
            },
            run: function async(data) {
              data.response.params = data.params;
            }
          }
        };
      });

      afterAll(() => {
        delete api.actions.actions.testAction;
        delete api.actions.versions.testAction;
        config.general.missingParamChecks = [null, "", undefined];
      });

      test("correct params that are falsey (false, []) should be allowed", async () => {
        let response;
        response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: false }
        });
        expect(response.params.schemaParam.requiredParam).toEqual(false);
        response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: [] }
        });
        expect(response.params.schemaParam.requiredParam).toHaveLength(0);
      });

      test("will fail for missing or empty string params", async () => {
        let response;
        response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: "" }
        });
        expect(response.error).toContain(
          "schemaParam.requiredParam is a required parameter for this action"
        );
        response = await specHelper.runAction("testAction", {
          schemaParam: {}
        });
        expect(response.error).toContain(
          "schemaParam.requiredParam is a required parameter for this action"
        );
      });

      test("correct params respect config options", async () => {
        let response;
        config.general.missingParamChecks = [undefined];
        response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: "" }
        });
        expect(response.params.schemaParam.requiredParam).toEqual("");
        response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: null }
        });
        expect(response.params.schemaParam.requiredParam).toBeNull();
      });

      test("will set a default when params are not provided", async () => {
        const response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: true }
        });
        expect(response.params.schemaParam.fancyParam).toEqual("abc123");
      });

      test("will use validator if provided", async () => {
        const response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: true, fancyParam: 123 }
        });
        expect(response.error).toMatch(/Error: fancyParam should be "abc123"/);
      });

      test("validator will have the API object in scope as this", async () => {
        const response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: true, fancyParam: 123 }
        });
        expect(response.error).toMatch(new RegExp(api.id));
      });

      test("will use formatter if provided (and still use validator)", async () => {
        const response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: true, fancyParam: 123 }
        });
        expect(
          response.requesterInformation.receivedParams.schemaParam.fancyParam
        ).toEqual("123");
      });

      test("will filter params not set in the target action or global safelist", async () => {
        const response = await specHelper.runAction("testAction", {
          schemaParam: { requiredParam: true, sleepDuration: true }
        });
        expect(
          response.requesterInformation.receivedParams.schemaParam.requiredParam
        ).toBeTruthy();
        expect(
          response.requesterInformation.receivedParams.schemaParam.sleepDuration
        ).toBeUndefined();
      });
    });

    describe("named action validations", () => {
      beforeAll(() => {
        api.validators = {
          validator1: param => {
            if (typeof param !== "string") {
              throw new Error("only strings");
            }
            return true;
          },
          validator2: param => {
            if (param !== "correct") {
              throw new Error("that is not correct");
            }
            return true;
          }
        };

        api.actions.versions.testAction = [1];
        api.actions.actions.testAction = {
          1: {
            name: "testAction",
            description: "I am a test",
            inputs: {
              a: {
                validator: [
                  "api.validators.validator1",
                  "api.validators.validator2"
                ]
              }
            },
            run: data => {}
          }
        };
      });

      afterAll(() => {
        delete api.actions.versions.testAction;
        delete api.actions.actions.testAction;
        delete api.validators;
      });

      test("runs validator arrays in the proper order", async () => {
        const response = await specHelper.runAction("testAction", { a: 6 });
        expect(response.error).toEqual("Error: only strings");
      });

      test("runs more than 1 validator", async () => {
        const response = await specHelper.runAction("testAction", {
          a: "hello"
        });
        expect(response.error).toEqual("Error: that is not correct");
      });

      test("succeeds multiple validators", async () => {
        const response = await specHelper.runAction("testAction", {
          a: "correct"
        });
        expect(response.error).toBeUndefined();
      });
    });

    describe("named action formatters", () => {
      beforeAll(() => {
        api._formatters = {
          formatter1: param => {
            return "*" + param + "*";
          },
          formatter2: param => {
            return "~" + param + "~";
          }
        };

        api.actions.versions.testAction = [1];
        api.actions.actions.testAction = {
          1: {
            name: "testAction",
            description: "I am a test",
            inputs: {
              a: {
                formatter: [
                  "api._formatters.formatter1",
                  "api._formatters.formatter2"
                ]
              }
            },
            run: async data => {
              data.response.a = data.params.a;
            }
          }
        };
      });

      afterAll(() => {
        delete api.actions.versions.testAction;
        delete api.actions.actions.testAction;
        delete api._formatters;
      });

      test("runs formatter arrays in the proper order", async () => {
        const response = await specHelper.runAction("testAction", { a: 6 });
        expect(response.a).toEqual("~*6*~");
      });
    });

    describe("immutability of data.params", () => {
      beforeAll(() => {
        api.actions.versions.testAction = [1];
        api.actions.actions.testAction = {
          1: {
            name: "testAction",
            description: "I am a test",
            inputs: {
              a: { required: true }
            },
            run: async ({ params, response }) => {
              params.a = "changed!";
              response.a = params.a;
            }
          }
        };
      });

      afterAll(() => {
        delete api.actions.actions.testAction;
        delete api.actions.versions.testAction;
      });

      test("prevents data.params from being modified", async () => {
        const response = await specHelper.runAction("testAction", {
          a: "original"
        });
        expect(response.a).toBeUndefined();
        expect(response.error).toMatch(
          /Cannot assign to read only property 'a' of object/
        );
      });
    });
  });
});
