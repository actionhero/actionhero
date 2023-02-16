process.env.AUTOMATIC_ROUTES = "head,get,post,put,delete";

import axios, { AxiosError } from "axios";
import * as FormData from "form-data";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { api, Process, config, utils, route } from "./../../../src/index";

const actionhero = new Process();
let url: string;

describe("Server: Web", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web!.port;
  });

  afterAll(async () => await actionhero.stop());

  test("should be up and return data", async () => {
    await axios.get(url + "/api/randomNumber");
    // should throw no errors
  });

  test("basic response should be JSON and have basic data", async () => {
    const response = await axios.get(url + "/api/randomNumber");
    expect(response).toBeInstanceOf(Object);
    expect(response.data.requesterInformation).toBeInstanceOf(Object);
  });

  test("returns JSON with errors", async () => {
    try {
      await axios.get(url + "/api");
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(404);
        expect(error.response?.data.requesterInformation).toBeInstanceOf(
          Object
        );
      } else throw error;
    }
  });

  test("params work", async () => {
    try {
      await axios.get(url + "/api?key=value");
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(404);
        expect(
          error.response?.data.requesterInformation.receivedParams.key
        ).toEqual("value");
      } else throw error;
    }
  });

  test("params are ignored unless they are in the whitelist", async () => {
    try {
      await axios.get(url + "/api?crazyParam123=something");
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(404);
        expect(
          error.response?.data.requesterInformation.receivedParams.crazyParam123
        ).toBeUndefined();
      } else throw error;
    }
  });

  describe("will properly destroy connections", () => {
    beforeAll(() => {
      config.web!.returnErrorCodes = true;
      api.actions.versions.customRender = [1];
      api.actions.actions.customRender = {
        // @ts-ignore
        1: {
          name: "customRender",
          description: "I am a test",
          version: 1,
          outputExample: {},
          run: async (data) => {
            data.toRender = false;
            data.connection!.rawConnection.res.writeHead(200, {
              "Content-Type": "text/plain",
            });
            data.connection!.rawConnection.res.end(`${Math.random()}`);
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.customRender;
      delete api.actions.versions.customRender;
    });

    test("works for the API", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      axios.get(url + "/api/sleepTest"); // don't await

      await utils.sleep(100);
      expect(Object.keys(api.connections.connections)).toHaveLength(1);

      await utils.sleep(1000);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });

    test("works for files", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      await axios.get(url + "/simple.html");
      await utils.sleep(100);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });

    test("works for actions with toRender: false", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      const body = await axios.get(url + "/api/customRender");
      expect(body).toBeTruthy();
      await utils.sleep(200);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });
  });

  describe("errors", () => {
    beforeAll(() => {
      api.actions.versions.stringErrorTestAction = [1];
      api.actions.actions.stringErrorTestAction = {
        // @ts-ignore
        1: {
          name: "stringErrorTestAction",
          description: "stringErrorTestAction",
          version: 1,
          run: async (data) => {
            data.response!.error = "broken";
          },
        },
      };

      api.actions.versions.errorErrorTestAction = [1];
      api.actions.actions.errorErrorTestAction = {
        // @ts-ignore
        1: {
          name: "errorErrorTestAction",
          description: "errorErrorTestAction",
          version: 1,
          run: async () => {
            throw new Error("broken");
          },
        },
      };

      api.actions.versions.complexErrorTestAction = [1];
      api.actions.actions.complexErrorTestAction = {
        // @ts-ignore
        1: {
          name: "complexErrorTestAction",
          description: "complexErrorTestAction",
          version: 1,
          run: async (data) => {
            data.response!.error = { error: "broken", reason: "stuff" };
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.stringErrorTestAction;
      delete api.actions.versions.stringErrorTestAction;
      delete api.actions.actions.errorErrorTestAction;
      delete api.actions.versions.errorErrorTestAction;
      delete api.actions.actions.complexErrorTestAction;
      delete api.actions.versions.complexErrorTestAction;
    });

    test("errors can be error strings", async () => {
      try {
        await axios.get(url + "/api/stringErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(500);
          expect(error.response?.data.error).toEqual("broken");
        } else throw error;
      }
    });

    test("errors can be error objects and returned plainly", async () => {
      try {
        await axios.get(url + "/api/errorErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(500);
          expect(error.response?.data.error).toEqual("broken");
        } else throw error;
      }
    });

    test("errors can be complex JSON payloads", async () => {
      try {
        await axios.get(url + "/api/complexErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(500);
          expect(error.response?.data.error).toEqual({
            error: "broken",
            reason: "stuff",
          });
        } else throw error;
      }
    });
  });

  describe("if disableParamScrubbing is set", () => {
    let orig: boolean;
    beforeAll(() => {
      orig = config.general!.disableParamScrubbing as boolean;
      config.general!.disableParamScrubbing = true;
    });

    afterAll(() => {
      config.general!.disableParamScrubbing = orig;
    });

    test("params are not ignored", async () => {
      try {
        await axios.get(url + "/api/testAction/?crazyParam123=something");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
          expect(
            error.response?.data.requesterInformation.receivedParams
              .crazyParam123
          ).toEqual("something");
        } else throw error;
      }
    });
  });

  test("gibberish actions have the right response", async () => {
    try {
      await axios.get(url + "/api/IAMNOTANACTION");
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(404);
        expect(error.response?.data.error).toEqual(
          "unknown action or invalid apiVersion"
        );
      } else throw error;
    }
  });

  test("real actions do not have an error response", async () => {
    const response = await axios.get(url + "/api/status");
    expect(response.data.error).toBeUndefined();
  });

  test("HTTP Verbs should work: GET", async () => {
    const response = await axios.get(url + "/api/randomNumber");
    expect(response.data.randomNumber).toBeGreaterThanOrEqual(0);
    expect(response.data.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: PUT", async () => {
    const response = await axios.put(url + "/api/randomNumber");
    expect(response.data.randomNumber).toBeGreaterThanOrEqual(0);
    expect(response.data.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: POST", async () => {
    const response = await axios.post(url + "/api/randomNumber");
    expect(response.data.randomNumber).toBeGreaterThanOrEqual(0);
    expect(response.data.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: DELETE", async () => {
    const response = await axios.delete(url + "/api/randomNumber");
    expect(response.data.randomNumber).toBeGreaterThanOrEqual(0);
    expect(response.data.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: Post with Form", async () => {
    try {
      const formDataA = new FormData();
      formDataA.append("key", "key");
      await axios.post(url + "/api/cacheTest", formDataA);
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(422);
        expect(error.response?.data.error).toEqual(
          "value is a required parameter for this action"
        );
      } else throw error;
    }

    const formDataB = new FormData();
    formDataB.append("key", "key");
    formDataB.append("value", "value");
    const successResponse = await axios.post(url + "/api/cacheTest", formDataB);

    expect(successResponse.data.cacheTestResults.saveResp).toEqual(true);
  });

  test("HTTP Verbs should work: Post with JSON Payload as body", async () => {
    try {
      await axios.post(url + "/api/cacheTest", { key: "key" });
      throw new Error("should not get here");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(422);
        expect(error.response?.data.error).toEqual(
          "value is a required parameter for this action"
        );
      } else throw error;
    }

    const successResponse = await axios.post(url + "/api/cacheTest", {
      key: "key",
      value: "value",
    });

    expect(successResponse.data.cacheTestResults.saveResp).toEqual(true);
  });

  describe("messageId", () => {
    test("generates unique messageIds for each request", async () => {
      const responseA = await axios.get(url + "/api/randomNumber");
      const responseB = await axios.get(url + "/api/randomNumber");
      expect(responseA.data.requesterInformation.messageId).not.toEqual(
        responseB.data.requesterInformation.messageId
      );
    });

    test("messageIds can be provided by the client and returned by the server", async () => {
      const response = await axios.get(url + "/api/randomNumber?messageId=aaa");
      expect(response.data.requesterInformation.messageId).not.toEqual("aaa");
    });

    test("a connection id should be a combination of fingerprint and message id", async () => {
      const response = await axios.get(url + "/api/randomNumber");
      expect(response.data.requesterInformation.id).toEqual(
        `${response.data.requesterInformation.fingerprint}-${response.data.requesterInformation.messageId}`
      );
    });
  });

  describe("connection.rawConnection.params", () => {
    beforeAll(() => {
      api.actions.versions.paramTestAction = [1];
      api.actions.actions.paramTestAction = {
        // @ts-ignore
        1: {
          name: "paramTestAction",
          description: "I return connection.rawConnection.params",
          version: 1,
          run: async (data) => {
            data.response = data.connection!.rawConnection.params;
            if (data.connection!.rawConnection.params.rawBody) {
              data.response!.rawBody =
                data.connection!.rawConnection.params.rawBody.toString();
            }
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.paramTestAction;
      delete api.actions.versions.paramTestAction;
    });

    test(".query should contain unfiltered query params", async () => {
      const response = await axios.get(
        url + "/api/paramTestAction/?crazyParam123=something"
      );
      expect(response.data.query.crazyParam123).toEqual("something");
    });

    test(".body should contain unfiltered, parsed request body params", async () => {
      const response = await axios.post(url + "/api/paramTestAction", {
        key: "value",
      });

      expect(response.data.body.key).toEqual("value");
    });

    // TODO: Cannot post a body payload with Axios...
    test.skip(".rawBody can be disabled", async () => {
      config.web!.saveRawBody = false;
      const requestBody = '{"key":      "value"}';
      const response = await axios.post(
        url + "/api/paramTestAction",
        requestBody
      );
      expect(response.data.body.key).toEqual("value");
      expect(response.data.rawBody).toEqual("");
    });
  });

  test("returnErrorCodes can be opted to change http header codes", async () => {
    try {
      await axios.delete(url + "/api/");
    } catch (error) {
      if (error instanceof AxiosError) {
        expect(error.response?.status).toEqual(404);
      } else throw error;
    }
  });

  describe("http header", () => {
    beforeAll(() => {
      api.actions.versions.headerTestAction = [1];
      api.actions.actions.headerTestAction = {
        // @ts-ignore
        1: {
          name: "headerTestAction",
          description: "I am a test",
          version: 1,
          outputExample: {},
          run: async (data) => {
            data.connection!.rawConnection.responseHeaders.push(["thing", "A"]);
            data.connection!.rawConnection.responseHeaders.push(["thing", "B"]);
            data.connection!.rawConnection.responseHeaders.push(["thing", "C"]);
            data.connection!.rawConnection.responseHeaders.push([
              "Set-Cookie",
              "value_1=1",
            ]);
            data.connection!.rawConnection.responseHeaders.push([
              "Set-Cookie",
              "value_2=2",
            ]);
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.headerTestAction;
      delete api.actions.versions.headerTestAction;
    });

    test("duplicate headers should be removed (in favor of the last set)", async () => {
      const response = await axios.get(url + "/api/headerTestAction");
      expect(response.status).toEqual(200);
      expect(response.headers.thing).toEqual("C");
    });

    test("but duplicate set-cookie requests should be allowed", async () => {
      const response = await axios.get(url + "/api/headerTestAction");
      expect(response.status).toEqual(200);
      // this will convert node >= 10 header array to look like node <= 9 combined strings
      const cookieString = (response.headers["set-cookie"] || [""]).join();
      const parts = cookieString.split(",");
      expect(parts[1]).toEqual("value_1=1");
      expect(parts[0]).toEqual("value_2=2");
    });

    test("should respond to OPTIONS with only HTTP headers", async () => {
      const response = await axios.options(url + "/api/cacheTest");
      expect(response.status).toEqual(200);
      expect(response.headers["access-control-allow-methods"]).toEqual(
        "HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE"
      );
      expect(response.headers["access-control-allow-origin"]).toEqual("*");
      expect(response.headers["content-length"]).toEqual("0");
      expect(response.data).toEqual("");
    });

    test("should respond to TRACE with parsed params received", async () => {
      const response = await axios({
        method: "trace",
        url: url + "/api/x",
        data: { key: "someKey", value: "someValue" },
      });
      expect(response.status).toEqual(200);
      expect(response.data.receivedParams.key).toEqual("someKey");
      expect(response.data.receivedParams.value).toEqual("someValue");
    });

    test("should respond to HEAD requests just like GET, but with no body", async () => {
      const response = await axios.head(url + "/api/headerTestAction");
      expect(response.status).toEqual(200);
      expect(response.data).toEqual("");
    });

    test("keeps sessions with browser_fingerprint", async () => {
      const jar = new CookieJar();
      const client = wrapper(axios.create({ jar }));

      const response1 = await client.post(url + "/api/randomNumber");
      const response2 = await client.get(url + "/api/randomNumber");
      const response3 = await client.put(url + "/api/randomNumber");
      const response4 = await client.delete(url + "/api/randomNumber");
      const response5 = await axios.delete(url + "/api/randomNumber");

      expect(response1.headers["set-cookie"]).toBeTruthy();
      expect(response2.headers["set-cookie"]).toBeUndefined();
      expect(response3.headers["set-cookie"]).toBeUndefined();
      expect(response4.headers["set-cookie"]).toBeUndefined();
      expect(response5.headers["set-cookie"]).toBeTruthy();

      const fingerprint1 = response1.data.requesterInformation.id.split("-")[0];
      const fingerprint2 = response2.data.requesterInformation.id.split("-")[0];
      const fingerprint3 = response3.data.requesterInformation.id.split("-")[0];
      const fingerprint4 = response4.data.requesterInformation.id.split("-")[0];
      const fingerprint5 = response5.data.requesterInformation.id.split("-")[0];

      expect(fingerprint1).toEqual(fingerprint2);
      expect(fingerprint1).toEqual(fingerprint3);
      expect(fingerprint1).toEqual(fingerprint4);
      expect(fingerprint1).not.toEqual(fingerprint5);

      expect(fingerprint1).toEqual(
        response1.data.requesterInformation.fingerprint
      );
      expect(fingerprint2).toEqual(
        response2.data.requesterInformation.fingerprint
      );
      expect(fingerprint3).toEqual(
        response3.data.requesterInformation.fingerprint
      );
      expect(fingerprint4).toEqual(
        response4.data.requesterInformation.fingerprint
      );
      expect(fingerprint5).toEqual(
        response5.data.requesterInformation.fingerprint
      );
    });
  });

  describe("http returnErrorCodes true", () => {
    class ErrorWithCode extends Error {
      code: number;
    }

    beforeAll(() => {
      api.actions.versions.statusTestAction = [1];
      api.actions.actions.statusTestAction = {
        // @ts-ignore
        1: {
          name: "statusTestAction",
          description: "I am a test",
          inputs: {
            key: { required: true },
            query: { required: false },
            randomKey: { required: false },
          },
          run: async (data) => {
            if (data.params!.key !== "value") {
              data.connection!.rawConnection.responseHttpCode = 402;
              throw new ErrorWithCode("key != value");
            }
            const hasQueryParam = !!data.params!.query;
            if (hasQueryParam) {
              const validQueryFilters = ["test", "search"];
              const validQueryParam =
                validQueryFilters.indexOf(data.params!.query) > -1;
              if (!validQueryParam) {
                const notFoundError = new ErrorWithCode(
                  `404: Filter '${data.params!.query}' not found `
                );
                notFoundError.code = 404;
                throw notFoundError;
              }
            }
            const hasRandomKey = !!data.params!.randomKey;
            if (hasRandomKey) {
              const validRandomKeys = ["key1", "key2", "key3"];
              const validRandomKey =
                validRandomKeys.indexOf(data.params!.randomKey) > -1;
              if (!validRandomKey) {
                if (data.params!.randomKey === "expired-key") {
                  const expiredError = new ErrorWithCode(
                    `999: Key '${data.params!.randomKey}' is expired`
                  );
                  expiredError.code = 999;
                  throw expiredError;
                }
                const suspiciousError = new ErrorWithCode(
                  `402: Suspicious Activity detected with key ${
                    data.params!.randomKey
                  }`
                );
                suspiciousError.code = 402;
                throw suspiciousError;
              }
            }
            data.response!.good = true;
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.versions.statusTestAction;
      delete api.actions.actions.statusTestAction;
    });

    test("actions that do not exists should return 404", async () => {
      try {
        await axios.post(url + "/api/aFakeAction");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
        } else throw error;
      }
    });

    test("missing params result in a 422", async () => {
      try {
        await axios.post(url + "/api/statusTestAction");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(422);
        } else throw error;
      }
    });

    test("status codes can be set for errors", async () => {
      try {
        await axios.post(url + "/api/statusTestAction", { key: "bannana" });
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(402);
          expect(error.response?.data.error).toEqual("key != value");
        } else throw error;
      }
    });

    test("status code should still be 200 if everything is OK", async () => {
      const response = await axios.post(url + "/api/statusTestAction", {
        key: "value",
      });
      expect(response.status).toEqual(200);
      expect(response.data.good).toEqual(true);
    });

    describe("setting status code using custom errors", () => {
      test("should work for 404 status code, set using custom error for invalid params", async () => {
        try {
          await axios.post(url + "/api/statusTestAction", {
            key: "value",
            query: "guess",
          });
          throw new Error("should not get here");
        } catch (error) {
          if (error instanceof AxiosError) {
            expect(error.response?.status).toEqual(404);
            expect(error.response?.data.error).toEqual(
              "404: Filter 'guess' not found "
            );
          } else throw error;
        }
      });

      test("should work for 402 status code set using custom error for invalid params", async () => {
        try {
          await axios.post(url + "/api/statusTestAction", {
            key: "value",
            randomKey: "guessKey",
          });
          throw new Error("should not get here");
        } catch (error) {
          if (error instanceof AxiosError) {
            expect(error.response?.status).toEqual(402);
            expect(error.response?.data.error).toEqual(
              "402: Suspicious Activity detected with key guessKey"
            );
          } else throw error;
        }
      });

      test("should not throw custom error for valid params", async () => {
        const responseWithQuery = await axios.post(
          url + "/api/statusTestAction",
          { key: "value", query: "test" }
        );
        expect(responseWithQuery.status).toEqual(200);
        expect(responseWithQuery.data.good).toEqual(true);

        const responseWithRandomKey = await axios.post(
          url + "/api/statusTestAction",
          { key: "value", randomKey: "key1" }
        );
        expect(responseWithRandomKey.status).toEqual(200);
        expect(responseWithRandomKey.data.good).toEqual(true);

        const responseWithKeyAndQuery = await axios.post(
          url + "/api/statusTestAction",
          {
            key: "value",
            query: "search",
            randomKey: "key2",
          }
        );
        expect(responseWithKeyAndQuery.status).toEqual(200);
        expect(responseWithKeyAndQuery.data.good).toEqual(true);
      });

      test("should not work for 999 status code set using custom error and default error code, 400 is thrown", async () => {
        try {
          await axios.post(url + "/api/statusTestAction", {
            key: "value",
            randomKey: "expired-key",
          });
          throw new Error("should not get here");
        } catch (error) {
          if (error instanceof AxiosError) {
            expect(error.response?.status).not.toEqual(999);
            expect(error.response?.status).toEqual(500);
            expect(error.response?.data.error).toEqual(
              "999: Key 'expired-key' is expired"
            );
          } else throw error;
        }
      });
    });
  });

  describe("documentation", () => {
    test("documentation can be returned via a swagger action", async () => {
      const response = await axios.get(url + "/api/swagger");
      expect(response.data.paths).toBeInstanceOf(Object);
    });
  });

  describe("files", () => {
    test("an HTML file", async () => {
      const response = await axios.get(url + "/public/simple.html");
      expect(response.status).toEqual(200);
      expect(response.data).toContain("<h1>Actionhero</h1>");
    });

    test("404 pages", async () => {
      try {
        await axios.get(url + "/public/notARealFile");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
        } else throw error;
      }
    });

    test("404 pages from POST with if-modified-since header", async () => {
      const file = Math.random().toString(36);
      try {
        await axios.get(url + "/" + file, {
          headers: { "if-modified-since": "Thu, 19 Apr 2012 09:51:20 GMT" },
        });
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
          expect(error.response?.data).toEqual("that file is not found");
        } else throw error;
      }
    });

    test("should not see files outside of the public dir", async () => {
      try {
        await axios.get(url + "/public/../config.json");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
          expect(error.response?.data).toEqual("that file is not found");
        } else throw error;
      }
    });

    test("index page should be served when requesting a path (trailing slash)", async () => {
      const response = await axios.get(url + "/public/");
      expect(response.status).toEqual(200);
      expect(response.data).toMatch(
        /Actionhero is a multi-transport API Server/
      );
    });

    test("index page should be served when requesting a path (no trailing slash)", async () => {
      const response = await axios.get(url + "/public");
      expect(response.status).toEqual(200);
      expect(response.data).toMatch(
        /Actionhero is a multi-transport API Server/
      );
    });

    describe("can serve files from a specific mapped route", () => {
      beforeAll(() => {
        const testFolderPublicPath = path.join(
          __dirname,
          "/../../../public/testFolder"
        );
        fs.mkdirSync(testFolderPublicPath);
        fs.writeFileSync(
          testFolderPublicPath + "/testFile.html",
          "Actionhero Route Test File"
        );

        route.registerRoute(
          "get",
          "/my/public/route",
          // @ts-ignore
          null,
          null,
          true,
          testFolderPublicPath
        );
      });

      afterAll(() => {
        const testFolderPublicPath = path.join(
          __dirname,
          "/../../../public/testFolder"
        );
        fs.unlinkSync(testFolderPublicPath + path.sep + "testFile.html");
        fs.rmdirSync(testFolderPublicPath);
      });

      test("works for routes mapped paths", async () => {
        const response = await axios.get(
          url + "/my/public/route/testFile.html"
        );
        expect(response.status).toEqual(200);
        expect(response.data).toEqual("Actionhero Route Test File");
      });

      test("returns 404 for files not available in route mapped paths", async () => {
        try {
          await axios.get(url + "/my/public/route/fileNotFound.html");
        } catch (error) {
          if (error instanceof AxiosError) {
            expect(error.response?.status).toEqual(404);
            expect(error.response?.data).toEqual("that file is not found");
          } else throw error;
        }
      });

      test("should not see files outside of the mapped dir", async () => {
        try {
          await axios.get(url + "/my/public/route/../../config/servers/web.js");
        } catch (error) {
          if (error instanceof AxiosError) {
            expect(error.response?.status).toEqual(404);
            expect(error.response?.data).toEqual("that file is not found");
          } else throw error;
        }
      });
    });

    describe("can serve files from more than one directory", () => {
      const source = path.join(__dirname, "/../../../public/simple.html");

      beforeAll(() => {
        fs.createReadStream(source).pipe(
          fs.createWriteStream(os.tmpdir() + path.sep + "tmpTestFile.html")
        );
        api.staticFile.searchLocations.push(os.tmpdir());
      });

      afterAll(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + "tmpTestFile.html");
        api.staticFile.searchLocations.pop();
      });

      test("works for secondary paths", async () => {
        const response = await axios.get(url + "/public/tmpTestFile.html");
        expect(response.status).toEqual(200);
        expect(response.data).toContain("<h1>Actionhero</h1>");
      });
    });
  });

  describe("custom methods", () => {
    let originalRoutes: typeof api.routes.routes;

    beforeAll(() => {
      originalRoutes = api.routes.routes;
      api.actions.versions.proxyHeaders = [1];
      api.actions.actions.proxyHeaders = {
        // @ts-ignore
        1: {
          name: "proxyHeaders",
          description: "proxy header test",
          inputs: {},
          outputExample: {},
          run: async (data) => {
            data.connection!.setHeader!("X-Foo", "bar");
          },
        },
      };

      api.actions.versions.proxyStatusCode = [1];
      api.actions.actions.proxyStatusCode = {
        // @ts-ignore
        1: {
          name: "proxyStatusCode",
          description: "proxy status code test",
          inputs: {
            code: {
              required: true,
              default: 200,
              formatter: (p: string) => {
                return parseInt(p);
              },
            },
          },
          outputExample: {},
          run: async (data) => {
            data.connection!.setStatusCode!(data.params!.code);
          },
        },
      };

      api.actions.versions.pipe = [1];
      api.actions.actions.pipe = {
        // @ts-ignore
        1: {
          name: "pipe",
          description: "pipe response test",
          inputs: {
            mode: { required: true },
          },
          outputExample: {},
          run: async (data) => {
            data.toRender = false;
            if (data.params!.mode === "string") {
              data.connection!.pipe!("a string", { "custom-header": "cool" });
            } else if (data.params!.mode === "buffer") {
              data.connection!.pipe!(Buffer.from("a buffer"), {
                "custom-header": "still-cool",
              });
            } else if (data.params!.mode === "contentType") {
              data.connection!.pipe!("just some good, old-fashioned words", {
                "Content-Type": "text/plain",
                "custom-header": "words",
              });
            } else {
              throw new Error("I Do not know this mode");
            }
          },
        },
      };

      api.routes.loadRoutes({
        get: [
          { path: "/proxy", action: "proxyHeaders", apiVersion: 1 },
          { path: "/code", action: "proxyStatusCode", apiVersion: 1 },
          { path: "/pipe", action: "pipe", apiVersion: 1 },
        ],
      });
    });

    afterAll(() => {
      api.routes.routes = originalRoutes;
      delete api.actions.versions.proxyHeaders;
      delete api.actions.versions.proxyStatusCode;
      delete api.actions.versions.pipe;
      delete api.actions.actions.proxyHeaders;
      delete api.actions.actions.proxyStatusCode;
      delete api.actions.actions.pipe;
    });

    test("actions handled by the web server support proxy for setHeaders", async () => {
      const response = await axios.get(url + "/api/proxy");
      expect(response.headers["x-foo"]).toEqual("bar");
    });

    test("actions handled by the web server support proxy for setting status code", async () => {
      const responseDefault = await axios.get(url + "/api/proxyStatusCode", {});
      expect(responseDefault.status).toEqual(200);

      try {
        await axios.get(url + "/api/proxyStatusCode?code=404");
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(404);
        } else throw error;
      }
    });

    test("can pipe string responses with custom headers to clients", async () => {
      const response = await axios.get(url + "/api/pipe?mode=string");
      expect(response.headers["custom-header"]).toEqual("cool");
      expect(response.headers["content-length"]).toEqual("8");
      expect(response.data).toEqual("a string");
    });

    test("can pipe buffer responses with custom headers to clients", async () => {
      const response = await axios.get(url + "/api/pipe?mode=buffer");
      expect(response.headers["custom-header"]).toEqual("still-cool");
      expect(response.headers["content-length"]).toEqual("8");
      expect(response.data).toEqual("a buffer");
    });

    test("can pipe buffer responses with custom content types to clients", async () => {
      const { headers, data } = await axios.get(
        url + "/api/pipe?mode=contentType"
      );
      expect(headers["content-type"]).toEqual("text/plain");
      expect(headers["content-length"]).toEqual("35");
      expect(headers["custom-header"]).toEqual("words");
      expect(data).toEqual("just some good, old-fashioned words");
    });
  });
});
