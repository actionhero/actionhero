import * as request from "request-promise-native";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Process, config, utils, route } from "./../../../src/index";

const actionhero = new Process();
let api;
let url;

const toJson = async string => {
  try {
    return JSON.parse(string);
  } catch (error) {
    return error;
  }
};

describe("Server: Web", () => {
  beforeAll(async () => {
    api = await actionhero.start();
    url = "http://localhost:" + config.servers.web.port;
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("should be up and return data", async () => {
    await request.get(url + "/api/randomNumber").then(toJson);
    // should throw no errors
  });

  test("basic response should be JSON and have basic data", async () => {
    const body = await request.get(url + "/api/randomNumber").then(toJson);
    expect(body).toBeInstanceOf(Object);
    expect(body.requesterInformation).toBeInstanceOf(Object);
  });

  test("returns JSON with errors", async () => {
    try {
      await request.get(url + "/api").then(toJson);
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(404);
      const body = await toJson(error.response.body);
      expect(body.requesterInformation).toBeInstanceOf(Object);
    }
  });

  test("params work", async () => {
    try {
      await request.get(url + "/api?key=value").then(toJson);
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(404);
      const body = await toJson(error.response.body);
      expect(body.requesterInformation.receivedParams.key).toEqual("value");
    }
  });

  test("params are ignored unless they are in the whitelist", async () => {
    try {
      await request.get(url + "/api?crazyParam123=something").then(toJson);
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(404);
      const body = await toJson(error.response.body);
      expect(
        body.requesterInformation.receivedParams.crazyParam123
      ).toBeUndefined();
    }
  });

  describe("will properly destroy connections", () => {
    beforeAll(() => {
      config.servers.web.returnErrorCodes = true;
      api.actions.versions.customRender = [1];
      api.actions.actions.customRender = {
        1: {
          name: "customRender",
          description: "I am a test",
          version: 1,
          outputExample: {},
          run: data => {
            data.toRender = false;
            data.connection.rawConnection.res.writeHead(200, {
              "Content-Type": "text/plain"
            });
            data.connection.rawConnection.res.end(`${Math.random()}`);
          }
        }
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.customRender;
      delete api.actions.versions.customRender;
    });

    test("works for the API", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      request.get(url + "/api/sleepTest").then(toJson); // don't await

      await utils.sleep(100);
      expect(Object.keys(api.connections.connections)).toHaveLength(1);

      await utils.sleep(1000);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });

    test("works for files", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      await request.get(url + "/simple.html");
      await utils.sleep(100);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });

    test("works for actions with toRender: false", async () => {
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
      const body = await request.get(url + "/api/customRender").then(toJson);
      expect(body).toBeTruthy();
      await utils.sleep(100);
      expect(Object.keys(api.connections.connections)).toHaveLength(0);
    });
  });

  describe("errors", () => {
    beforeAll(() => {
      api.actions.versions.stringErrorTestAction = [1];
      api.actions.actions.stringErrorTestAction = {
        1: {
          name: "stringErrorTestAction",
          description: "stringErrorTestAction",
          version: 1,
          run: data => {
            data.response.error = "broken";
          }
        }
      };

      api.actions.versions.errorErrorTestAction = [1];
      api.actions.actions.errorErrorTestAction = {
        1: {
          name: "errorErrorTestAction",
          description: "errorErrorTestAction",
          version: 1,
          run: data => {
            throw new Error("broken");
          }
        }
      };

      api.actions.versions.complexErrorTestAction = [1];
      api.actions.actions.complexErrorTestAction = {
        1: {
          name: "complexErrorTestAction",
          description: "complexErrorTestAction",
          version: 1,
          run: data => {
            data.response.error = { error: "broken", reason: "stuff" };
          }
        }
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
        await request.get(url + "/api/stringErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(400);
        const body = await toJson(error.response.body);
        expect(body.error).toEqual("broken");
      }
    });

    test("errors can be error objects and returned plainly", async () => {
      try {
        await request.get(url + "/api/errorErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(400);
        const body = await toJson(error.response.body);
        expect(body.error).toEqual("broken");
      }
    });

    test("errors can be complex JSON payloads", async () => {
      try {
        await request.get(url + "/api/complexErrorTestAction");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(400);
        const body = await toJson(error.response.body);
        expect(body.error).toEqual({ error: "broken", reason: "stuff" });
      }
    });
  });

  describe("if disableParamScrubbing is set", () => {
    let orig;
    beforeAll(() => {
      orig = config.general.disableParamScrubbing;
      config.general.disableParamScrubbing = true;
    });

    afterAll(() => {
      config.general.disableParamScrubbing = orig;
    });

    test("params are not ignored", async () => {
      try {
        await request.get(url + "/api/testAction/?crazyParam123=something");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(404);
        const body = await toJson(error.response.body);
        expect(body.requesterInformation.receivedParams.crazyParam123).toEqual(
          "something"
        );
      }
    });
  });

  test("gibberish actions have the right response", async () => {
    try {
      await request.get(url + "/api/IAMNOTANACTION");
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(404);
      const body = await toJson(error.response.body);
      expect(body.error).toEqual("unknown action or invalid apiVersion");
    }
  });

  test("real actions do not have an error response", async () => {
    const body = await request.get(url + "/api/status").then(toJson);
    expect(body.error).toBeUndefined();
  });

  test("HTTP Verbs should work: GET", async () => {
    const body = await request.get(url + "/api/randomNumber").then(toJson);
    expect(body.randomNumber).toBeGreaterThanOrEqual(0);
    expect(body.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: PUT", async () => {
    const body = await request.put(url + "/api/randomNumber").then(toJson);
    expect(body.randomNumber).toBeGreaterThanOrEqual(0);
    expect(body.randomNumber).toBeLessThan(1);
  });

  test("HTTP Verbs should work: POST", async () => {
    const body = await request.post(url + "/api/randomNumber").then(toJson);
    expect(body.randomNumber).toBeGreaterThanOrEqual(0);
    expect(body.randomNumber).toBeLessThan(100);
  });

  test("HTTP Verbs should work: DELETE", async () => {
    const body = await request.delete(url + "/api/randomNumber").then(toJson);
    expect(body.randomNumber).toBeGreaterThanOrEqual(0);
    expect(body.randomNumber).toBeLessThan(1000);
  });

  test("HTTP Verbs should work: Post with Form", async () => {
    try {
      await request.post(url + "/api/cacheTest", { form: { key: "key" } });
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(422);
      expect(error.message).toMatch(
        /value is a required parameter for this action/
      );
    }

    const successBody = await request
      .post(url + "/api/cacheTest", { form: { key: "key", value: "value" } })
      .then(toJson);
    expect(successBody.cacheTestResults.saveResp).toEqual(true);
  });

  test("HTTP Verbs should work: Post with JSON Payload as body", async () => {
    let bodyPayload = JSON.stringify({ key: "key" });
    try {
      await request.post(url + "/api/cacheTest", {
        body: bodyPayload,
        headers: { "Content-type": "application/json" }
      });
      throw new Error("should not get here");
    } catch (error) {
      expect(error.statusCode).toEqual(422);
      expect(error.message).toMatch(
        /value is a required parameter for this action/
      );
    }

    bodyPayload = JSON.stringify({ key: "key", value: "value" });
    const successBody = await request
      .post(url + "/api/cacheTest", {
        body: bodyPayload,
        headers: { "Content-type": "application/json" }
      })
      .then(toJson);
    expect(successBody.cacheTestResults.saveResp).toEqual(true);
  });

  describe("messageId", () => {
    test("generates unique messageIds for each request", async () => {
      const requestA = await request
        .get(url + "/api/randomNumber")
        .then(toJson);
      const requestB = await request
        .get(url + "/api/randomNumber")
        .then(toJson);
      expect(requestA.requesterInformation.messageId).not.toEqual(
        requestB.requesterInformation.messageId
      );
    });

    test("messageIds can be provided by the client and returned by the server", async () => {
      const response = await request
        .get(url + "/api/randomNumber", { messageId: "aaa" })
        .then(toJson);
      expect(response.requesterInformation.messageId).not.toEqual("aaa");
    });

    test("a connection id should be a combination of fingerprint and message id", async () => {
      const response = await request
        .get(url + "/api/randomNumber")
        .then(toJson);
      expect(response.requesterInformation.id).toEqual(
        `${response.requesterInformation.fingerprint}-${response.requesterInformation.messageId}`
      );
    });
  });

  describe("connection.rawConnection.params", () => {
    beforeAll(() => {
      api.actions.versions.paramTestAction = [1];
      api.actions.actions.paramTestAction = {
        1: {
          name: "paramTestAction",
          description: "I return connection.rawConnection.params",
          version: 1,
          run: async data => {
            data.response = data.connection.rawConnection.params;
            if (data.connection.rawConnection.params.rawBody) {
              data.response.rawBody = data.connection.rawConnection.params.rawBody.toString();
            }
          }
        }
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.paramTestAction;
      delete api.actions.versions.paramTestAction;
    });

    test(".query should contain unfiltered query params", async () => {
      const body = await request
        .get(url + "/api/paramTestAction/?crazyParam123=something")
        .then(toJson);
      expect(body.query.crazyParam123).toEqual("something");
    });

    test(".body should contain unfiltered, parsed request body params", async () => {
      const requestBody = JSON.stringify({ key: "value" });
      const body = await request
        .post(url + "/api/paramTestAction", {
          body: requestBody,
          headers: { "Content-type": "application/json" }
        })
        .then(toJson);
      expect(body.body.key).toEqual("value");
    });

    test(".rawBody can be disabled", async () => {
      config.servers.web.saveRawBody = false;
      const requestBody = '{"key":      "value"}';
      const body = await request
        .post(url + "/api/paramTestAction", {
          body: requestBody,
          headers: { "Content-type": "application/json" }
        })
        .then(toJson);
      expect(body.body.key).toEqual("value");
      expect(body.rawBody).toEqual("");
    });
  });

  test("returnErrorCodes can be opted to change http header codes", async () => {
    try {
      await request.del(url + "/api/");
    } catch (error) {
      expect(error.statusCode).toEqual(404);
    }
  });

  describe("http header", () => {
    beforeAll(() => {
      api.actions.versions.headerTestAction = [1];
      api.actions.actions.headerTestAction = {
        1: {
          name: "headerTestAction",
          description: "I am a test",
          version: 1,
          outputExample: {},
          run: data => {
            data.connection.rawConnection.responseHeaders.push(["thing", "A"]);
            data.connection.rawConnection.responseHeaders.push(["thing", "B"]);
            data.connection.rawConnection.responseHeaders.push(["thing", "C"]);
            data.connection.rawConnection.responseHeaders.push([
              "Set-Cookie",
              "value_1=1"
            ]);
            data.connection.rawConnection.responseHeaders.push([
              "Set-Cookie",
              "value_2=2"
            ]);
          }
        }
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.headerTestAction;
      delete api.actions.versions.headerTestAction;
    });

    test("duplicate headers should be removed (in favor of the last set)", async () => {
      const response = await request.get(url + "/api/headerTestAction", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.headers.thing).toEqual("C");
    });

    test("but duplicate set-cookie requests should be allowed", async () => {
      const response = await request.get(url + "/api/headerTestAction", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      // this will convert node >= 10 header array to look like node <= 9 combined strings
      const cookieString = response.headers["set-cookie"].join();
      const parts = cookieString.split(",");
      expect(parts[1]).toEqual("value_1=1");
      expect(parts[0]).toEqual("value_2=2");
    });

    test("should respond to OPTIONS with only HTTP headers", async () => {
      const response = await request({
        method: "options",
        url: url + "/api/cacheTest",
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.headers["access-control-allow-methods"]).toEqual(
        "HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE"
      );
      expect(response.headers["access-control-allow-origin"]).toEqual("*");
      expect(response.headers["content-length"]).toEqual("0");
      expect(response.body).toEqual("");
    });

    test("should respond to TRACE with parsed params received", async () => {
      const response = await request({
        method: "trace",
        url: url + "/api/x",
        form: { key: "someKey", value: "someValue" },
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      const body = await toJson(response.body);
      expect(body.receivedParams.key).toEqual("someKey");
      expect(body.receivedParams.value).toEqual("someValue");
    });

    test("should respond to HEAD requests just like GET, but with no body", async () => {
      const response = await request({
        method: "head",
        url: url + "/api/headerTestAction",
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual("");
    });

    test("keeps sessions with browser_fingerprint", async () => {
      const j = request.jar();
      const response1 = await request.post({
        url: url + "/api/randomNumber",
        jar: j,
        resolveWithFullResponse: true
      });
      const response2 = await request.get({
        url: url + "/api/randomNumber",
        jar: j,
        resolveWithFullResponse: true
      });
      const response3 = await request.put({
        url: url + "/api/randomNumber",
        jar: j,
        resolveWithFullResponse: true
      });
      const response4 = await request.del({
        url: url + "/api/randomNumber",
        jar: j,
        resolveWithFullResponse: true
      });

      expect(response1.headers["set-cookie"]).toBeTruthy();
      expect(response2.headers["set-cookie"]).toBeUndefined();
      expect(response3.headers["set-cookie"]).toBeUndefined();
      expect(response4.headers["set-cookie"]).toBeUndefined();

      const body1 = await toJson(response1.body);
      const body2 = await toJson(response2.body);
      const body3 = await toJson(response3.body);
      const body4 = await toJson(response4.body);

      const fingerprint1 = body1.requesterInformation.id.split("-")[0];
      const fingerprint2 = body2.requesterInformation.id.split("-")[0];
      const fingerprint3 = body3.requesterInformation.id.split("-")[0];
      const fingerprint4 = body4.requesterInformation.id.split("-")[0];

      expect(fingerprint1).toEqual(fingerprint2);
      expect(fingerprint1).toEqual(fingerprint3);
      expect(fingerprint1).toEqual(fingerprint4);

      expect(fingerprint1).toEqual(body1.requesterInformation.fingerprint);
      expect(fingerprint2).toEqual(body2.requesterInformation.fingerprint);
      expect(fingerprint3).toEqual(body3.requesterInformation.fingerprint);
      expect(fingerprint4).toEqual(body4.requesterInformation.fingerprint);
    });
  });

  describe("http returnErrorCodes true", () => {
    class ErrorWithCode extends Error {
      code: number;
    }

    beforeAll(() => {
      api.actions.versions.statusTestAction = [1];
      api.actions.actions.statusTestAction = {
        1: {
          name: "statusTestAction",
          description: "I am a test",
          inputs: {
            key: { required: true },
            query: { required: false },
            randomKey: { required: false }
          },
          run: data => {
            if (data.params.key !== "value") {
              data.connection.rawConnection.responseHttpCode = 402;
              throw new ErrorWithCode("key != value");
            }
            const hasQueryParam = !!data.params.query;
            if (hasQueryParam) {
              const validQueryFilters = ["test", "search"];
              const validQueryParam =
                validQueryFilters.indexOf(data.params.query) > -1;
              if (!validQueryParam) {
                const notFoundError = new ErrorWithCode(
                  `404: Filter '${data.params.query}' not found `
                );
                notFoundError.code = 404;
                throw notFoundError;
              }
            }
            const hasRandomKey = !!data.params.randomKey;
            if (hasRandomKey) {
              const validRandomKeys = ["key1", "key2", "key3"];
              const validRandomKey =
                validRandomKeys.indexOf(data.params.randomKey) > -1;
              if (!validRandomKey) {
                if (data.params.randomKey === "expired-key") {
                  const expiredError = new ErrorWithCode(
                    `999: Key '${data.params.randomKey}' is expired`
                  );
                  expiredError.code = 999;
                  throw expiredError;
                }
                const suspiciousError = new ErrorWithCode(
                  `402: Suspicious Activity detected with key ${data.params.randomKey}`
                );
                suspiciousError.code = 402;
                throw suspiciousError;
              }
            }
            data.response.good = true;
          }
        }
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.versions.statusTestAction;
      delete api.actions.actions.statusTestAction;
    });

    test("actions that do not exists should return 404", async () => {
      try {
        await request.post(url + "/api/aFakeAction");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(404);
      }
    });

    test("missing params result in a 422", async () => {
      try {
        await request.post(url + "/api/statusTestAction");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(422);
      }
    });

    test("status codes can be set for errors", async () => {
      try {
        await request.post(url + "/api/statusTestAction", {
          form: { key: "bannana" }
        });
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(402);
        const body = await toJson(error.response.body);
        expect(body.error).toEqual("key != value");
      }
    });

    test("status code should still be 200 if everything is OK", async () => {
      const response = await request.post(url + "/api/statusTestAction", {
        form: { key: "value" },
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      const body = await toJson(response.body);
      expect(body.good).toEqual(true);
    });
    describe("setting status code using custom errors", () => {
      test("should work for 404 status code, set using custom error for invalid params", async () => {
        try {
          await request.post(url + "/api/statusTestAction", {
            form: { key: "value", query: "guess" }
          });
          throw new Error("should not get here");
        } catch (error) {
          expect(error.statusCode).toEqual(404);
          const body = await toJson(error.response.body);
          expect(body.error).toEqual("404: Filter 'guess' not found ");
        }
      });

      test("should work for 402 status code set using custom error for invalid params", async () => {
        try {
          await request.post(url + "/api/statusTestAction", {
            form: { key: "value", randomKey: "guessKey" }
          });
          throw new Error("should not get here");
        } catch (error) {
          expect(error.statusCode).toEqual(402);
          const body = await toJson(error.response.body);
          expect(body.error).toEqual(
            "402: Suspicious Activity detected with key guessKey"
          );
        }
      });

      test("should not throw custom error for valid params", async () => {
        const responseWithQuery = await request.post(
          url + "/api/statusTestAction",
          {
            form: { key: "value", query: "test" },
            resolveWithFullResponse: true
          }
        );
        expect(responseWithQuery.statusCode).toEqual(200);
        const responseBody = await toJson(responseWithQuery.body);
        expect(responseBody.good).toEqual(true);

        const responseWithRandomKey = await request.post(
          url + "/api/statusTestAction",
          {
            form: { key: "value", randomKey: "key1" },
            resolveWithFullResponse: true
          }
        );
        expect(responseWithRandomKey.statusCode).toEqual(200);
        const body = await toJson(responseWithRandomKey.body);
        expect(body.good).toEqual(true);

        const responseWithKeyAndQuery = await request.post(
          url + "/api/statusTestAction",
          {
            form: { key: "value", query: "search", randomKey: "key2" },
            resolveWithFullResponse: true
          }
        );
        expect(responseWithKeyAndQuery.statusCode).toEqual(200);
        const receivedBody = await toJson(responseWithKeyAndQuery.body);
        expect(receivedBody.good).toEqual(true);
      });

      test("should not work for 999 status code set using custom error and default error code, 400 is thrown", async () => {
        try {
          await request.post(url + "/api/statusTestAction", {
            form: { key: "value", randomKey: "expired-key" }
          });
          throw new Error("should not get here");
        } catch (error) {
          expect(error.statusCode).not.toEqual(999);
          expect(error.statusCode).toEqual(400);
          const body = await toJson(error.response.body);
          expect(body.error).toEqual("999: Key 'expired-key' is expired");
        }
      });
    });
  });

  describe("documentation", () => {
    test("documentation can be returned via a documentation action", async () => {
      const body = await request
        .get(url + "/api/showDocumentation")
        .then(toJson);
      expect(body.documentation).toBeInstanceOf(Object);
    });

    test("should have actions with all the right parts", async () => {
      const body = await request
        .get(url + "/api/showDocumentation")
        .then(toJson);
      for (const actionName in body.documentation) {
        for (const version in body.documentation[actionName]) {
          const action = body.documentation[actionName][version];
          expect(typeof action.name).toEqual("string");
          expect(typeof action.description).toEqual("string");
          expect(action.inputs).toBeInstanceOf(Object);
        }
      }
    });
  });

  describe("files", () => {
    test("an HTML file", async () => {
      const response = await request.get(url + "/public/simple.html", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual(
        "<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />"
      );
    });

    test("404 pages", async () => {
      try {
        await request.get(url + "/public/notARealFile");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(404);
      }
    });

    test("404 pages from POST with if-modified-since header", async () => {
      const file = Math.random().toString(36);
      const options = {
        url: url + "/" + file,
        headers: {
          "if-modified-since": "Thu, 19 Apr 2012 09:51:20 GMT"
        }
      };

      try {
        await request.get(options);
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(404);
        expect(error.response.body).toEqual("That file is not found");
      }
    });

    test("should not see files outside of the public dir", async () => {
      try {
        await request.get(url + "/public/../config.json");
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(404);
        expect(error.response.body).toEqual("That file is not found");
      }
    });

    test("index page should be served when requesting a path (trailing slash)", async () => {
      const response = await request.get(url + "/public/", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.body).toMatch(
        /ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/
      );
    });

    test("index page should be served when requesting a path (no trailing slash)", async () => {
      const response = await request.get(url + "/public", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
      expect(response.body).toMatch(
        /ActionHero.js is a multi-transport API Server with integrated cluster capabilities and delayed tasks/
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
          "ActionHero Route Test File"
        );

        route.registerRoute(
          "get",
          "/my/public/route",
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
        const response = await request.get(
          url + "/my/public/route/testFile.html",
          { resolveWithFullResponse: true }
        );
        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual("ActionHero Route Test File");
      });

      test("returns 404 for files not available in route mapped paths", async () => {
        try {
          await request.get(url + "/my/public/route/fileNotFound.html");
        } catch (error) {
          expect(error.statusCode).toEqual(404);
          expect(error.response.body).toEqual("That file is not found");
        }
      });

      test("should not see files outside of the mapped dir", async () => {
        try {
          await request.get(
            url + "/my/public/route/../../config/servers/web.js"
          );
        } catch (error) {
          expect(error.statusCode).toEqual(404);
          expect(error.response.body).toEqual("That file is not found");
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
        const response = await request.get(url + "/public/tmpTestFile.html", {
          resolveWithFullResponse: true
        });
        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual(
          "<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />"
        );
      });
    });
  });

  describe("custom methods", () => {
    let originalRoutes;

    beforeAll(() => {
      originalRoutes = api.routes.routes;
      api.actions.versions.proxyHeaders = [1];
      api.actions.actions.proxyHeaders = {
        1: {
          name: "proxyHeaders",
          description: "proxy header test",
          inputs: {},
          outputExample: {},
          run: data => {
            data.connection.setHeader("X-Foo", "bar");
          }
        }
      };

      api.actions.versions.proxyStatusCode = [1];
      api.actions.actions.proxyStatusCode = {
        1: {
          name: "proxyStatusCode",
          description: "proxy status code test",
          inputs: {
            code: {
              required: true,
              default: 200,
              formatter: p => {
                return parseInt(p);
              }
            }
          },
          outputExample: {},
          run: data => {
            data.connection.setStatusCode(data.params.code);
          }
        }
      };

      api.actions.versions.pipe = [1];
      api.actions.actions.pipe = {
        1: {
          name: "pipe",
          description: "pipe response test",
          inputs: {
            mode: { required: true }
          },
          outputExample: {},
          run: data => {
            data.toRender = false;
            if (data.params.mode === "string") {
              data.connection.pipe("a string", { "custom-header": "cool" });
            } else if (data.params.mode === "buffer") {
              data.connection.pipe(Buffer.from("a buffer"), {
                "custom-header": "still-cool"
              });
            } else if (data.params.mode === "contentType") {
              data.connection.pipe("just some good, old-fashioned words", {
                "Content-Type": "text/plain",
                "custom-header": "words"
              });
            } else {
              throw new Error("I Do not know this mode");
            }
          }
        }
      };

      api.routes.loadRoutes({
        get: [
          { path: "/proxy", action: "proxyHeaders", apiVersion: 1 },
          { path: "/code", action: "proxyStatusCode", apiVersion: 1 },
          { path: "/pipe", action: "pipe", apiVersion: 1 }
        ]
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
      const response = await request.get(url + "/api/proxy", {
        resolveWithFullResponse: true
      });
      expect(response.headers["x-foo"]).toEqual("bar");
    });

    test("actions handled by the web server support proxy for setting status code", async () => {
      const responseDefault = await request.get(url + "/api/proxyStatusCode", {
        resolveWithFullResponse: true
      });
      expect(responseDefault.statusCode).toEqual(200);

      try {
        await request.get(url + "/api/proxyStatusCode?code=404", {
          resolveWithFullResponse: true
        });
        throw new Error("should not get here");
      } catch (error) {
        expect(error.toString()).toMatch(/StatusCodeError: 404/);
      }
    });

    test("can pipe string responses with custom headers to clients", async () => {
      const response = await request.get(url + "/api/pipe?mode=string", {
        resolveWithFullResponse: true
      });
      expect(response.headers["custom-header"]).toEqual("cool");
      expect(response.headers["content-length"]).toEqual("8");
      expect(response.body).toEqual("a string");
    });

    test("can pipe buffer responses with custom headers to clients", async () => {
      const response = await request.get(url + "/api/pipe?mode=buffer", {
        resolveWithFullResponse: true
      });
      expect(response.headers["custom-header"]).toEqual("still-cool");
      expect(response.headers["content-length"]).toEqual("8");
      expect(response.body).toEqual("a buffer");
    });

    test("can pipe buffer responses with custom content types to clients", async () => {
      const { headers, body } = await request.get(
        url + "/api/pipe?mode=contentType",
        { resolveWithFullResponse: true }
      );
      expect(headers["content-type"]).toEqual("text/plain");
      expect(headers["content-length"]).toEqual("35");
      expect(headers["custom-header"]).toEqual("words");
      expect(body).toEqual("just some good, old-fashioned words");
    });
  });
});
