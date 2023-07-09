import {
  api,
  Process,
  config,
  action,
  utils,
  specHelper,
  ActionProcessor,
  Connection,
} from "./../../src";

const actionhero = new Process();
let defaultMiddlewarePriority: number;

describe("Core: Middleware", () => {
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  beforeAll(() => {
    defaultMiddlewarePriority = config!.general!
      .defaultMiddlewarePriority as number;
  });

  afterEach(() => {
    api.actions.middleware = {};
    api.actions.globalMiddleware = [];
  });

  describe("action preProcessors", () => {
    test("can define a global preProcessor and it can append the connection", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: true,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._preProcessorNote = "note";
        },
      });

      const { _preProcessorNote, error } = await specHelper.runAction<any>(
        "randomNumber",
      );
      expect(error).toBeUndefined();
      expect(_preProcessorNote).toEqual("note");
    });

    test("can define an async global preProcessor and it can append the connection", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: true,
        preProcessor: async (data: ActionProcessor<any>) => {
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          data.response._preProcessorNote = "slept";
        },
      });

      const { _preProcessorNote, error } = await specHelper.runAction<any>(
        "randomNumber",
      );
      expect(error).toBeUndefined();
      expect(_preProcessorNote).toEqual("slept");
    });

    test("can define a local preProcessor and it will not append the connection when not applied to the action", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: false,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._preProcessorNote = "note";
        },
      });

      const { _preProcessorNote, error } = await specHelper.runAction<any>(
        "randomNumber",
      );
      expect(error).toBeUndefined();
      expect(_preProcessorNote).toBeUndefined();
    });

    describe("middleware can read properties of the action template", () => {
      const sessions: any[] = [];

      beforeAll(() => {
        api.actions.versions.authAction = [1];
        api.actions.actions.authAction = {
          1: {
            name: "authAction",
            description: "I am a test",
            version: 1,
            //@ts-ignore
            authenticated: true,
            run: async ({ response, session }) => {
              sessions.push(session);
              response!.thing = "stuff";
            },
          },
        };
      });

      afterAll(() => {
        delete api.actions.actions.authAction;
        delete api.actions.versions.authAction;
      });

      test("can read action template properties", async () => {
        action.addMiddleware({
          name: "auth middleware",
          global: true,
          preProcessor: (data: ActionProcessor<any>) => {
            if (data.actionTemplate.authenticated === true) {
              data.response.authenticatedAction = true;
            } else {
              data.response.authenticatedAction = false;
            }
          },
        });

        const randomResponse = await specHelper.runAction<any>("randomNumber");
        expect(randomResponse.authenticatedAction).toEqual(false);

        const authResponse = await specHelper.runAction<any>("authAction");
        expect(authResponse.authenticatedAction).toEqual(true);
      });

      test("middleware can add data to the session", async () => {
        action.addMiddleware({
          name: "session middleware",
          global: true,
          preProcessor: async (data: ActionProcessor<any>) => {
            data.session = { id: "abc123" };
          },
        });

        await specHelper.runAction("authAction");
        const lastSession = sessions.pop();
        expect(lastSession.id).toBe("abc123");
      });
    });

    test("preProcessors with priorities run in the right order", async () => {
      // first priority
      action.addMiddleware({
        name: "first test middleware",
        global: true,
        priority: 1,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteFirst = "first";
          data.response._processorNoteEarly = "first";
          data.response._processorNoteLate = "first";
          data.response._processorNoteDefault = "first";
        },
      });

      // lower number priority (runs sooner)
      action.addMiddleware({
        name: "early test middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteEarly = "early";
          data.response._processorNoteLate = "early";
          data.response._processorNoteDefault = "early";
        },
      });

      // old style "default" priority
      action.addMiddleware({
        name: "default test middleware",
        global: true,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteLate = "default";
          data.response._processorNoteDefault = "default";
        },
      });

      // higher number priority (runs later)
      action.addMiddleware({
        name: "late test middleware",
        global: true,
        priority: defaultMiddlewarePriority + 1,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteLate = "late";
        },
      });

      const response = await specHelper.runAction<any>("randomNumber");
      expect(response._processorNoteFirst).toEqual("first");
      expect(response._processorNoteEarly).toEqual("early");
      expect(response._processorNoteDefault).toEqual("default");
      expect(response._processorNoteLate).toEqual("late");
    });

    test("multiple preProcessors with same priority are executed", async () => {
      action.addMiddleware({
        name: "first test middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteFirst = "first";
        },
      });

      action.addMiddleware({
        name: "late test middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        preProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteSecond = "second";
        },
      });

      const response = await specHelper.runAction<any>("randomNumber");
      expect(response._processorNoteFirst).toEqual("first");
      expect(response._processorNoteSecond).toEqual("second");
    });

    test("postProcessors can append the connection", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: true,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._postProcessorNote = "note";
        },
      });

      const response = await specHelper.runAction<any>("randomNumber");
      expect(response._postProcessorNote).toEqual("note");
    });

    test("postProcessors with priorities run in the right order", async () => {
      // first priority
      action.addMiddleware({
        name: "first test middleware",
        global: true,
        priority: 1,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteFirst = "first";
          data.response._processorNoteEarly = "first";
          data.response._processorNoteLate = "first";
          data.response._processorNoteDefault = "first";
        },
      });

      // lower number priority (runs sooner)
      action.addMiddleware({
        name: "early test middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteEarly = "early";
          data.response._processorNoteLate = "early";
          data.response._processorNoteDefault = "early";
        },
      });

      // old style "default" priority
      action.addMiddleware({
        name: "default test middleware",
        global: true,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteLate = "default";
          data.response._processorNoteDefault = "default";
        },
      });

      // higher number priority (runs later)
      action.addMiddleware({
        name: "late test middleware",
        global: true,
        priority: defaultMiddlewarePriority + 1,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteLate = "late";
        },
      });

      const response = await specHelper.runAction<any>("randomNumber");
      expect(response._processorNoteFirst).toEqual("first");
      expect(response._processorNoteEarly).toEqual("early");
      expect(response._processorNoteDefault).toEqual("default");
      expect(response._processorNoteLate).toEqual("late");
    });

    test("multiple postProcessors with same priority are executed", async () => {
      action.addMiddleware({
        name: "first middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteFirst = "first";
        },
      });

      action.addMiddleware({
        name: "second middleware",
        global: true,
        priority: defaultMiddlewarePriority - 1,
        postProcessor: (data: ActionProcessor<any>) => {
          data.response._processorNoteSecond = "second";
        },
      });

      const response = await specHelper.runAction<any>("randomNumber");
      expect(response._processorNoteFirst).toEqual("first");
      expect(response._processorNoteSecond).toEqual("second");
    });

    test("preProcessors can block actions", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: true,
        preProcessor: function () {
          throw new Error("BLOCKED");
        },
      });

      const { randomNumber, error } = await specHelper.runAction<any>(
        "randomNumber",
      );
      expect(error).toEqual("Error: BLOCKED");
      expect(randomNumber).toBeUndefined();
    });

    test("postProcessors can modify toRender", async () => {
      action.addMiddleware({
        name: "test middleware",
        global: true,
        postProcessor: (data: ActionProcessor<any>) => {
          data.toRender = false;
        },
      });

      await new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve(null);
        }, 1000);
        specHelper.runAction("randomNumber").then(() => {
          throw new Error("should.not.get.here");
        });
      });
    });
  });

  describe("connection sync create/destroy callbacks", () => {
    let connection: Connection;
    beforeEach(() => {
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
    });

    afterEach(() => {
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
    });

    test("can create callbacks on connection creation", async () => {
      let middlewareRan = false;
      api.connections.addMiddleware({
        name: "connection middleware",
        create: (_connection: Connection) => {
          middlewareRan = true;
          //@ts-ignore
          _connection["touched"] = "connect";
        },
      });

      connection = await specHelper.buildConnection();

      expect(middlewareRan).toEqual(true);
      //@ts-ignore
      expect(connection["touched"]).toEqual("connect");
    });

    test("can create callbacks on connection destroy", async () => {
      let middlewareRan = false;
      api.connections.addMiddleware({
        name: "connection middleware",
        destroy: (_connection: Connection) => {
          middlewareRan = true;
          //@ts-ignore
          expect(_connection["touched"]).toEqual("connect");
        },
      });

      connection.destroy();
      expect(middlewareRan).toEqual(true);
    });
  });

  describe("connection async create/destroy callbacks", () => {
    beforeEach(() => {
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
    });

    afterEach(() => {
      api.connections.middleware = {};
      api.connections.globalMiddleware = [];
    });

    test("can create async callbacks on connection create/destroy", async () => {
      let middlewareRan = false;
      let middlewareDestroyRan = false;

      api.connections.addMiddleware({
        name: "connection middleware",
        create: async (_connection: Connection) => {
          middlewareRan = true;
          await utils.sleep(1);
          //@ts-ignore
          _connection["longProcessResult"] = true;
        },
        destroy: async (_connection: Connection) => {
          await utils.sleep(1);
          middlewareDestroyRan = true;
        },
      });

      const connection = await specHelper.buildConnection();

      // create
      expect(middlewareRan).toEqual(true);
      //@ts-ignore
      expect(connection["longProcessResult"]).toEqual(true);

      // destroy
      await connection.destroy();
      expect(middlewareDestroyRan).toEqual(true);
    });
  });
});
