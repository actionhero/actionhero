import { Process, specHelper, task } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Core: specHelper", () => {
  beforeAll(async () => {
    api = await actionhero.start();
  });
  afterAll(async () => {
    await actionhero.stop();
  });

  test("can make a request with just params", async () => {
    const { randomNumber } = await specHelper.runAction("randomNumber");
    expect(randomNumber).toBeGreaterThanOrEqual(0);
    expect(randomNumber).toBeLessThan(1);
  });

  test("will stack up messages received", async () => {
    const connection = await specHelper.buildConnection();
    connection.params.thing = "stuff";
    const { error } = await specHelper.runAction("x", connection);
    expect(connection.messages).toHaveLength(2);
    expect(connection.messages[0].welcome).toEqual(
      "Hello! Welcome to the actionhero api"
    );
    expect(connection.messages[1].error).toEqual(
      "Error: unknown action or invalid apiVersion"
    );
    expect(error).toEqual("Error: unknown action or invalid apiVersion");
  });

  describe("metadata, type-safety, and errors", () => {
    beforeAll(() => {
      api.actions.versions.stringResponseTestAction = [1];
      api.actions.actions.stringResponseTestAction = {
        1: {
          name: "stringResponseTestAction",
          description: "stringResponseTestAction",
          version: 1,
          run: data => {
            data.response = "something response";
          }
        }
      };

      api.actions.versions.stringErrorTestAction = [1];
      api.actions.actions.stringErrorTestAction = {
        1: {
          name: "stringErrorTestAction",
          description: "stringErrorTestAction",
          version: 1,
          run: data => {
            data.response = "something response";
            throw new Error("some error");
          }
        }
      };

      api.actions.versions.arrayResponseTestAction = [1];
      api.actions.actions.arrayResponseTestAction = {
        1: {
          name: "arrayResponseTestAction",
          description: "arrayResponseTestAction",
          version: 1,
          run: data => {
            data.response = [1, 2, 3];
          }
        }
      };

      api.actions.versions.arrayErrorTestAction = [1];
      api.actions.actions.arrayErrorTestAction = {
        1: {
          name: "arrayErrorTestAction",
          description: "arrayErrorTestAction",
          version: 1,
          run: data => {
            data.response = [1, 2, 3];
            throw new Error("some error");
          }
        }
      };
    });

    afterAll(() => {
      delete api.actions.actions.stringResponseTestAction;
      delete api.actions.versions.stringResponseTestAction;
      delete api.actions.actions.stringErrorTestAction;
      delete api.actions.versions.stringErrorTestAction;
      delete api.actions.actions.arrayResponseTestAction;
      delete api.actions.versions.arrayResponseTestAction;
      delete api.actions.actions.arrayErrorTestAction;
      delete api.actions.versions.arrayErrorTestAction;
    });

    describe("happy-path", () => {
      test("if the response payload is an object, it appends metadata", async () => {
        const response = await specHelper.runAction("randomNumber");
        expect(response.error).toBeUndefined();
        expect(response.randomNumber).toBeTruthy();
        expect(response.messageId).toBeTruthy();
        expect(response.serverInformation.serverName).toEqual("actionhero");
        expect(response.requesterInformation.remoteIP).toEqual("testServer");
      });

      test("if the response payload is a string, it maintains type", async () => {
        const response = await specHelper.runAction("stringResponseTestAction");
        expect(response).toEqual("something response");
        expect(response.error).toBeUndefined();
        expect(response.messageId).toBeUndefined();
        expect(response.serverInformation).toBeUndefined();
        expect(response.requesterInformation).toBeUndefined();
      });

      test("if the response payload is a array, it maintains type", async () => {
        const response = await specHelper.runAction("arrayResponseTestAction");
        expect(response).toEqual([1, 2, 3]);
        expect(response.error).toBeUndefined();
        expect(response.messageId).toBeUndefined();
        expect(response.serverInformation).toBeUndefined();
        expect(response.requesterInformation).toBeUndefined();
      });
    });

    describe("disabling metadata", () => {
      beforeAll(() => {
        api.specHelper.returnMetadata = false;
      });
      afterAll(() => {
        api.specHelper.returnMetadata = true;
      });

      test("if the response payload is an object, it should not append metadata", async () => {
        const response = await specHelper.runAction("randomNumber");
        expect(response.error).toBeUndefined();
        expect(response.randomNumber).toBeTruthy();
        expect(response.messageId).toBeUndefined();
        expect(response.serverInformation).toBeUndefined();
        expect(response.requesterInformation).toBeUndefined();
      });
    });

    describe("errors", () => {
      test("if the response payload is an object and there is an error, it appends metadata", async () => {
        const response = await specHelper.runAction("x");
        expect(response.error).toEqual(
          "Error: unknown action or invalid apiVersion"
        );
        expect(response.messageId).toBeTruthy();
        expect(response.serverInformation.serverName).toEqual("actionhero");
        expect(response.requesterInformation.remoteIP).toEqual("testServer");
      });

      test("if the response payload is a string, just the error will be returned", async () => {
        const response = await specHelper.runAction("stringErrorTestAction");
        expect(response).toEqual("Error: some error");
        expect(response.messageId).toBeUndefined();
        expect(response.serverInformation).toBeUndefined();
        expect(response.requesterInformation).toBeUndefined();
      });

      test("if the response payload is a array, just the error will be returned", async () => {
        const response = await specHelper.runAction("arrayErrorTestAction");
        expect(response).toEqual("Error: some error");
        expect(response.messageId).toBeUndefined();
        expect(response.serverInformation).toBeUndefined();
        expect(response.requesterInformation).toBeUndefined();
      });
    });
  });

  describe("test responses", () => {
    test("will not report a broken test as a broken action (sync)", async () => {
      const response = await specHelper.runAction("randomNumber");
      try {
        response.not.a.real.thing();
        throw new Error("should not get here");
      } catch (e) {
        expect(String(e)).toEqual(
          "TypeError: Cannot read property 'a' of undefined"
        );
      }
    });

    test("will not report a broken test as a broken action (async)", async () => {
      const response = await specHelper.runAction("sleepTest");
      try {
        response.not.a.real.thing();
        throw new Error("should not get here");
      } catch (e) {
        expect(String(e)).toEqual(
          "TypeError: Cannot read property 'a' of undefined"
        );
      }
    });

    test("messageId can be configurable", async () => {
      const response = await specHelper.runAction("randomNumber", {
        messageId: "aaa"
      });
      expect(response.messageId).toEqual("aaa");
    });
  });

  describe("files", () => {
    test("can request file data", async () => {
      const data = await specHelper.getStaticFile("simple.html");
      expect(data.error).toBeUndefined();
      expect(data.content).toEqual(
        "<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />"
      );
      expect(data.mime).toEqual("text/html");
      expect(data.length).toEqual(101);
    });

    test("missing files", async () => {
      const data = await specHelper.getStaticFile("missing.html");
      expect(data.error).toEqual("That file is not found");
      expect(data.mime).toEqual("text/html");
      expect(data.content).toBeNull();
    });
  });

  describe("persistent test connections", () => {
    let connection;
    let connId;
    const messageIds = [];

    test("can make a requset with a spec'd connection", async () => {
      connection = await specHelper.buildConnection();
      connection.params = {
        key: "someKey",
        value: "someValue"
      };

      connId = connection.id;

      const response = await specHelper.runAction("cacheTest", connection);
      messageIds.push(response.messageId);
      expect(connection.messages).toHaveLength(2);
      expect(connId).toEqual(connection.id);
      expect(connection.fingerprint).toEqual(connId);
    });

    test("can make second request", async () => {
      const response = await specHelper.runAction("randomNumber", connection);
      messageIds.push(response.messageId);
      expect(connection.messages).toHaveLength(3);
      expect(connId).toEqual(connection.id);
      expect(connection.fingerprint).toEqual(connId);
    });

    test("will generate new ids and fingerprints for a new connection", async () => {
      const response = await specHelper.runAction("randomNumber");
      messageIds.push(response.messageId);
      expect(response.requesterInformation.id).not.toEqual(connId);
      expect(response.requesterInformation.fingerprint).not.toEqual(connId);
    });

    test("message ids are unique", () => {
      expect(messageIds).toHaveLength(3);
      expect(messageIds[0]).not.toEqual(messageIds[1]);
      expect(messageIds[1]).not.toEqual(messageIds[2]);
    });
  });

  describe("tasks", () => {
    let taskRan = false;
    beforeAll(() => {
      api.tasks.tasks.testTask = {
        name: "testTask",
        description: "task: test: " + Math.random(),
        queue: "default",
        frequency: 0,
        plugins: [],
        pluginOptions: {},
        run: (api, params) => {
          taskRan = true;
          return "OK";
        }
      };

      api.tasks.jobs.testTask = api.tasks.jobWrapper("testTask");
    });

    afterAll(() => {
      delete api.testOutput;
      delete api.tasks.tasks.testTask;
    });

    test("can run tasks", async () => {
      const response = await specHelper.runTask("testTask", {});
      expect(response).toEqual("OK");
      expect(taskRan).toEqual(true);
    });

    describe("flushed redis", () => {
      beforeEach(async () => {
        await api.redis.clients.client.flushdb();
      });

      test("findEnqueuedTasks (normal queues)", async () => {
        await task.enqueue("testTask", { a: 1 });
        const foundTasks = await specHelper.findEnqueuedTasks("testTask");
        expect(foundTasks.length).toBe(1);
        expect(foundTasks[0].args[0]).toEqual({ a: 1 });
      });

      test("findEnqueuedTasks (delayed queues)", async () => {
        await task.enqueueIn(1, "testTask", { a: 1 });
        const foundTasks = await specHelper.findEnqueuedTasks("testTask");
        expect(foundTasks.length).toBe(1);
        expect(foundTasks[0].args[0]).toEqual({ a: 1 });
      });

      test("deleteEnqueuedTasks", async () => {
        await task.enqueue("testTask", { a: 1 });
        await task.enqueueAt(10, "testTask", { a: 1 });
        await specHelper.deleteEnqueuedTasks("testTask", { a: 1 });
        const foundTasks = await specHelper.findEnqueuedTasks("testTask");
        expect(foundTasks.length).toBe(0);
      });
    });
  });
});
