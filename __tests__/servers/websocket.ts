"use strict";
// we need to use 'use strict' here because we are relying on EVAL to load a variable

import { Process, config, chatRoom, utils } from "./../../src/index";

const actionhero = new Process();
let api;
let clientA;
let clientB;
let clientC;

let url;

const connectClients = async () => {
  // get ActionheroWebsocketClient in scope
  const ActionheroWebsocketClient = eval(
    api.servers.servers.websocket.compileActionheroWebsocketClientJS()
  ); // eslint-disable-line

  const S = api.servers.servers.websocket.server.Socket;
  url = "http://localhost:" + config.servers.web.port;
  const clientAsocket = new S(url);
  const clientBsocket = new S(url);
  const clientCsocket = new S(url);

  clientA = new ActionheroWebsocketClient({}, clientAsocket); // eslint-disable-line
  clientB = new ActionheroWebsocketClient({}, clientBsocket); // eslint-disable-line
  clientC = new ActionheroWebsocketClient({}, clientCsocket); // eslint-disable-line

  await utils.sleep(100);
};

const awaitMethod = async (
  client,
  method,
  returnsError = false
): Promise<{
  [key: string]: any;
}> => {
  return new Promise((resolve, reject) => {
    client[method]((a, b) => {
      if (returnsError && a) {
        return reject(a);
      }
      if (returnsError) {
        return resolve(b);
      }
      return resolve(a);
    });
  });
};

const awaitAction = async (client, action, params = {}): Promise<any> => {
  return new Promise(resolve => {
    client.action(action, params, response => {
      return resolve(response);
    });
  });
};

const awaitFile = async (client, file): Promise<any> => {
  return new Promise(resolve => {
    client.file(file, response => {
      return resolve(response);
    });
  });
};

const awaitRoom = async (client, method, room): Promise<any> => {
  return new Promise(resolve => {
    client[method](room, response => {
      return resolve(response);
    });
  });
};

describe("Server: Web Socket", () => {
  beforeAll(async () => {
    api = await actionhero.start();
    await api.redis.clients.client.flushdb();
    await api.redis.clients.client.flushdb();
    await chatRoom.add("defaultRoom");
    await chatRoom.add("otherRoom");

    url = "http://localhost:" + config.servers.web.port;
    config.servers.websocket.clientUrl = url;
    await connectClients();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("socket client connections should work: client 1", async () => {
    const data = await awaitMethod(clientA, "connect", true);
    expect(data.context).toEqual("response");
    expect(data.data.totalActions).toEqual(0);
    expect(clientA.welcomeMessage).toEqual(
      "Hello! Welcome to the actionhero api"
    );
  });

  test("socket client connections should work: client 2", async () => {
    const data = await awaitMethod(clientB, "connect", true);
    expect(data.context).toEqual("response");
    expect(data.data.totalActions).toEqual(0);
    expect(clientB.welcomeMessage).toEqual(
      "Hello! Welcome to the actionhero api"
    );
  });

  test("socket client connections should work: client 3", async () => {
    const data = await awaitMethod(clientC, "connect", true);
    expect(data.context).toEqual("response");
    expect(data.data.totalActions).toEqual(0);
    expect(clientC.welcomeMessage).toEqual(
      "Hello! Welcome to the actionhero api"
    );
  });

  describe("with connection", () => {
    beforeAll(async () => {
      await awaitMethod(clientA, "connect", true);
      await awaitMethod(clientB, "connect", true);
      await awaitMethod(clientC, "connect", true);
    });

    test("I can get my connection details", async () => {
      const response = await awaitMethod(clientA, "detailsView");
      expect(response.data.connectedAt).toBeLessThan(new Date().getTime());
      expect(response.data.remoteIP).toEqual("127.0.0.1");
    });

    test("can run actions with errors", async () => {
      const response = await awaitAction(clientA, "cacheTest");
      expect(response.error).toEqual(
        "key is a required parameter for this action"
      );
    });

    test("properly handles duplicate room commands at the same time", async () => {
      awaitRoom(clientA, "roomAdd", "defaultRoom");
      awaitRoom(clientA, "roomAdd", "defaultRoom");

      await utils.sleep(500);

      expect(clientA.rooms).toEqual(["defaultRoom"]);
    });

    test("properly responds with messageId", async () => {
      let aTime;
      let bTime;
      const startingMessageId = clientA.messageId;
      awaitRoom(clientA, "roomAdd", "defaultRoom"); // fast
      let responseA = awaitAction(clientA, "sleepTest"); // slow
      awaitRoom(clientA, "roomAdd", "defaultRoom"); // fast
      let responseB = awaitAction(clientA, "randomNumber"); // fast

      responseA.then(data => {
        responseA = data;
        aTime = new Date();
      });

      responseB.then(data => {
        responseB = data;
        bTime = new Date();
      });

      await utils.sleep(2001);

      //@ts-ignore
      expect(responseA.messageId).toEqual(startingMessageId + 2);
      //@ts-ignore
      expect(responseB.messageId).toEqual(startingMessageId + 4);
      expect(aTime.getTime()).toBeGreaterThan(bTime.getTime());
    });

    test("messageId can be configurable", async () => {
      const response = await awaitAction(clientA, "randomNumber", {
        messageId: "aaa"
      });
      expect(response.messageId).toBe("aaa");
    });

    test("can run actions properly without params", async () => {
      const response = await awaitAction(clientA, "randomNumber");
      expect(response.error).toBeUndefined();
      expect(response.randomNumber).toBeTruthy();
    });

    test("can run actions properly with params", async () => {
      const response = await awaitAction(clientA, "cacheTest", {
        key: "test key",
        value: "test value"
      });
      expect(response.error).toBeUndefined();
      expect(response.cacheTestResults).toBeTruthy();
    });

    test("does not have sticky params", async () => {
      const response = await awaitAction(clientA, "cacheTest", {
        key: "test key",
        value: "test value"
      });
      expect(response.cacheTestResults.loadResp.key).toEqual(
        "cacheTest_test key"
      );
      expect(response.cacheTestResults.loadResp.value).toEqual("test value");
      const responseAgain = await awaitAction(clientA, "cacheTest");
      expect(responseAgain.error).toEqual(
        "key is a required parameter for this action"
      );
    });

    test("will limit how many simultaneous connections I can have", async () => {
      const responses = [];
      clientA.action("sleepTest", { sleepDuration: 100 }, response => {
        responses.push(response);
      });
      clientA.action("sleepTest", { sleepDuration: 200 }, response => {
        responses.push(response);
      });
      clientA.action("sleepTest", { sleepDuration: 300 }, response => {
        responses.push(response);
      });
      clientA.action("sleepTest", { sleepDuration: 400 }, response => {
        responses.push(response);
      });
      clientA.action("sleepTest", { sleepDuration: 500 }, response => {
        responses.push(response);
      });
      clientA.action("sleepTest", { sleepDuration: 600 }, response => {
        responses.push(response);
      });

      await utils.sleep(1000);

      expect(responses).toHaveLength(6);
      for (const i in responses) {
        const response = responses[i];
        if (i.toString() === "0") {
          expect(response.error).toEqual("you have too many pending requests");
        } else {
          expect(response.error).toBeUndefined();
        }
      }
    });

    describe("files", () => {
      test("can request file data", async () => {
        const data = await awaitFile(clientA, "simple.html");
        expect(data.error).toBeUndefined();
        expect(data.content).toEqual(
          "<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />"
        );
        expect(data.mime).toEqual("text/html");
        expect(data.length).toEqual(101);
      });

      test("missing files", async () => {
        const data = await awaitFile(clientA, "missing.html");
        expect(data.error).toEqual("That file is not found");
        expect(data.mime).toEqual("text/html");
        expect(data.content).toBeNull();
      });
    });

    describe("chat", () => {
      beforeAll(() => {
        chatRoom.addMiddleware({
          name: "join chat middleware",
          join: async (connection, room) => {
            await api.chatRoom.broadcast(
              {},
              room,
              `I have entered the room: ${connection.id}`
            );
          }
        });

        chatRoom.addMiddleware({
          name: "leave chat middleware",
          leave: async (connection, room) => {
            api.chatRoom.broadcast(
              {},
              room,
              `I have left the room: ${connection.id}`
            );
          }
        });
      });

      afterAll(() => {
        api.chatRoom.middleware = {};
        api.chatRoom.globalMiddleware = [];
      });

      beforeEach(async () => {
        await awaitRoom(clientA, "roomAdd", "defaultRoom");
        await awaitRoom(clientB, "roomAdd", "defaultRoom");
        await awaitRoom(clientC, "roomAdd", "defaultRoom");
        // timeout to skip welcome messages as clients join rooms
        await utils.sleep(100);
      });

      afterEach(async () => {
        await awaitRoom(clientA, "roomLeave", "defaultRoom");
        await awaitRoom(clientB, "roomLeave", "defaultRoom");
        await awaitRoom(clientC, "roomLeave", "defaultRoom");
        await awaitRoom(clientA, "roomLeave", "otherRoom");
        await awaitRoom(clientB, "roomLeave", "otherRoom");
        await awaitRoom(clientC, "roomLeave", "otherRoom");
      });

      test("can change rooms and get room details", async () => {
        await awaitRoom(clientA, "roomAdd", "otherRoom");
        const response = await awaitMethod(clientA, "detailsView");
        expect(response.error).toBeUndefined();
        expect(response.data.rooms[0]).toEqual("defaultRoom");
        expect(response.data.rooms[1]).toEqual("otherRoom");

        const roomResponse = await awaitRoom(clientA, "roomView", "otherRoom");
        expect(roomResponse.data.membersCount).toEqual(1);
      });

      test("will update client room info when they change rooms", async () => {
        expect(clientA.rooms[0]).toEqual("defaultRoom");
        expect(clientA.rooms[1]).toBeUndefined();
        const response = await awaitRoom(clientA, "roomAdd", "otherRoom");
        expect(response.error).toBeUndefined();
        expect(clientA.rooms[0]).toEqual("defaultRoom");
        expect(clientA.rooms[1]).toEqual("otherRoom");

        const leaveResponse = await awaitRoom(
          clientA,
          "roomLeave",
          "defaultRoom"
        );
        expect(leaveResponse.error).toBeUndefined();
        expect(clientA.rooms[0]).toEqual("otherRoom");
        expect(clientA.rooms[1]).toBeUndefined();
      });

      test("clients can talk to each other", async () => {
        await new Promise(resolve => {
          const listener = response => {
            clientA.removeListener("say", listener);
            expect(response.context).toEqual("user");
            expect(response.message).toEqual("hello from client 2");
            resolve();
          };

          clientA.on("say", listener);
          clientB.say("defaultRoom", "hello from client 2");
        });
      });

      test("The client say method does not rely on argument order", async () => {
        await new Promise(resolve => {
          const listener = response => {
            clientA.removeListener("say", listener);
            expect(response.context).toEqual("user");
            expect(response.message).toEqual("hello from client 2");
            resolve();
          };

          clientB.say = (room, message) => {
            clientB.send({ message: message, room: room, event: "say" });
          };

          clientA.on("say", listener);
          clientB.say("defaultRoom", "hello from client 2");
        });
      });

      test("connections are notified when I join a room", async () => {
        await new Promise(resolve => {
          const listener = response => {
            clientA.removeListener("say", listener);
            expect(response.context).toEqual("user");
            expect(response.message).toEqual(
              "I have entered the room: " + clientB.id
            );
            resolve();
          };

          clientA.roomAdd("otherRoom", () => {
            clientA.on("say", listener);
            clientB.roomAdd("otherRoom");
          });
        });
      });

      test("connections are notified when I leave a room", async () => {
        await new Promise(resolve => {
          const listener = response => {
            clientA.removeListener("say", listener);
            expect(response.context).toEqual("user");
            expect(response.message).toEqual(
              "I have left the room: " + clientB.id
            );
            resolve();
          };

          clientA.on("say", listener);
          clientB.roomLeave("defaultRoom");
        });
      });

      test("will not get messages for rooms I am not in", async done => {
        const response = await awaitRoom(clientB, "roomAdd", "otherRoom");
        expect(response.error).toBeUndefined();
        expect(clientB.rooms.length).toEqual(2);
        expect(clientC.rooms.length).toEqual(1);

        const listener = response => {
          clientC.removeListener("say", listener);
          throw new Error("should not get here");
        };

        clientC.on("say", listener);

        clientB.say("otherRoom", "you should not hear this");
        await utils.sleep(1000);
        clientC.removeListener("say", listener);
        done();
      });

      test("connections can see member counts changing within rooms as folks join and leave", async () => {
        const response = await awaitRoom(clientA, "roomView", "defaultRoom");
        expect(response.data.membersCount).toEqual(3);
        await awaitRoom(clientB, "roomLeave", "defaultRoom");
        const responseAgain = await awaitRoom(
          clientA,
          "roomView",
          "defaultRoom"
        );
        expect(responseAgain.data.membersCount).toEqual(2);
      });

      describe("middleware - say and onSayReceive", () => {
        afterEach(() => {
          api.chatRoom.middleware = {};
          api.chatRoom.globalMiddleware = [];
        });

        test("each listener receive custom message", async () => {
          let messagesReceived = 0;
          chatRoom.addMiddleware({
            name: "say for each",
            say: async (connection, room, messagePayload) => {
              messagePayload.message += " - To: " + connection.id;
              return messagePayload;
            }
          });

          const listenerA = response => {
            messagesReceived++;
            clientA.removeListener("say", listenerA);
            expect(response.message).toEqual(
              "Test Message - To: " + clientA.id
            ); // clientA.id (Receiver)
          };

          const listenerB = response => {
            messagesReceived++;
            clientB.removeListener("say", listenerB);
            expect(response.message).toEqual(
              "Test Message - To: " + clientB.id
            ); // clientB.id (Receiver)
          };

          const listenerC = response => {
            messagesReceived++;
            clientC.removeListener("say", listenerC);
            expect(response.message).toEqual(
              "Test Message - To: " + clientC.id
            ); // clientC.id (Receiver)
          };

          clientA.on("say", listenerA);
          clientB.on("say", listenerB);
          clientC.on("say", listenerC);
          clientB.say("defaultRoom", "Test Message");

          await utils.sleep(1000);

          expect(messagesReceived).toEqual(3);
        });

        test("only one message should be received per connection", async () => {
          let firstSayCall = true;
          chatRoom.addMiddleware({
            name: "first say middleware",
            say: async (connection, room, messagePayload) => {
              if (firstSayCall) {
                firstSayCall = false;
                await utils.sleep(200);
              }
            }
          });

          let messagesReceived = 0;
          const listenerA = () => {
            clientA.removeListener("say", listenerA);
            messagesReceived += 1;
          };

          const listenerB = () => {
            clientB.removeListener("say", listenerB);
            messagesReceived += 2;
          };

          const listenerC = () => {
            clientC.removeListener("say", listenerC);
            messagesReceived += 4;
          };

          clientA.on("say", listenerA);
          clientB.on("say", listenerB);
          clientC.on("say", listenerC);
          clientB.say("defaultRoom", "Test Message");

          await utils.sleep(1000);

          expect(messagesReceived).toEqual(7);
        });

        test("each listener receive same custom message", async () => {
          let messagesReceived = 0;
          chatRoom.addMiddleware({
            name: "say for each",
            onSayReceive: (connection, room, messagePayload) => {
              messagePayload.message += " - To: " + connection.id;
              return messagePayload;
            }
          });

          const listenerA = response => {
            messagesReceived++;
            clientA.removeListener("say", listenerA);
            expect(response.message).toEqual(
              "Test Message - To: " + clientB.id
            ); // clientB.id (Sender)
          };

          const listenerB = response => {
            messagesReceived++;
            clientB.removeListener("say", listenerB);
            expect(response.message).toEqual(
              "Test Message - To: " + clientB.id
            ); // clientB.id (Sender)
          };

          const listenerC = response => {
            messagesReceived++;
            clientC.removeListener("say", listenerC);
            expect(response.message).toEqual(
              "Test Message - To: " + clientB.id
            ); // clientB.id (Sender)
          };

          clientA.on("say", listenerA);
          clientB.on("say", listenerB);
          clientC.on("say", listenerC);
          clientB.say("defaultRoom", "Test Message");

          await utils.sleep(1000);

          expect(messagesReceived).toEqual(3);
        });

        test("blocking middleware return an error", async () => {
          chatRoom.addMiddleware({
            name: "blocking chat middleware",
            join: (connection, room) => {
              throw new Error("joining rooms blocked");
            }
          });

          const joinResponse = await awaitRoom(clientA, "roomAdd", "otherRoom");
          expect(joinResponse.error).toEqual("Error: joining rooms blocked");
          expect(joinResponse.status).toEqual("Error: joining rooms blocked");
        });
      });
    });

    describe("param collisions", () => {
      let originalSimultaneousActions;

      beforeAll(() => {
        originalSimultaneousActions = config.general.simultaneousActions;
        config.general.simultaneousActions = 99999999;
      });

      afterAll(() => {
        config.general.simultaneousActions = originalSimultaneousActions;
      });

      test("will not have param collisions", async () => {
        let completed = 0;
        let started = 0;
        const sleeps = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];

        await new Promise(resolve => {
          const toComplete = (sleep, response) => {
            expect(sleep).toEqual(response.sleepDuration);
            completed++;
            if (completed === started) {
              resolve();
            }
          };

          sleeps.forEach(sleep => {
            started++;
            clientA.action("sleepTest", { sleepDuration: sleep }, response => {
              toComplete(sleep, response);
            });
          });
        });
      });
    });

    describe("disconnect", () => {
      beforeEach(async () => {
        try {
          clientA.disconnect();
          clientB.disconnect();
          clientC.disconnect();
        } catch (e) {}

        await connectClients();
        clientA.connect();
        clientB.connect();
        clientC.connect();
        await utils.sleep(500);
      });

      test("client can disconnect", async () => {
        expect(api.servers.servers.websocket.connections().length).toEqual(3);

        clientA.disconnect();
        clientB.disconnect();
        clientC.disconnect();

        await utils.sleep(500);

        expect(api.servers.servers.websocket.connections().length).toEqual(0);
      });

      test("can be sent disconnect events from the server", async () => {
        const response = await awaitMethod(clientA, "detailsView");
        expect(response.data.remoteIP).toEqual("127.0.0.1");

        let count = 0;
        for (const id in api.connections.connections) {
          count++;
          api.connections.connections[id].destroy();
        }
        expect(count).toEqual(3);

        clientA.detailsView(() => {
          throw new Error("should not get response");
        });

        await utils.sleep(500);
      });
    });
  });
});
