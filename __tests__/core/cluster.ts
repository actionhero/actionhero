import {
  api,
  Process,
  config,
  utils,
  specHelper,
  chatRoom,
  redis,
} from "./../../src";

const actionhero = new Process();

describe("Core: Action Cluster", () => {
  beforeAll(async () => {
    await actionhero.start();
    for (var room in config!.general!.startingChatRooms as Record<
      string,
      Record<string, any>
    >) {
      try {
        await chatRoom.destroy(room);
        await chatRoom.add(room);
      } catch (error) {
        console.log(error);
        if (
          config.errors &&
          typeof config.errors.connectionRoomExists === "function"
        ) {
          throw error;
        }
      }
    }
  });

  afterAll(async () => await actionhero.stop());

  describe("RPC", () => {
    afterEach(() => {
      delete api.rpcTestMethod;
    });

    test("can call remote methods on all other servers in the cluster", async () => {
      const data: Record<string, any> = {};
      api.rpcTestMethod = (arg1: any, arg2: any) => {
        data[1] = [arg1, arg2];
      };
      await redis.doCluster("api.rpcTestMethod", ["arg1", "arg2"]);
      await utils.sleep(100);

      expect(data[1][0]).toEqual("arg1");
      expect(data[1][1]).toEqual("arg2");
    });

    test("can call remote methods only on one other cluster who holds a specific connectionId", async () => {
      const client = await specHelper.buildConnection();
      const data: Record<string, any> = {};
      api.rpcTestMethod = (arg1: any, arg2: any) => {
        data[1] = [arg1, arg2];
      };

      await redis.doCluster("api.rpcTestMethod", ["arg1", "arg2"], client.id);
      await utils.sleep(100);

      expect(data[1][0]).toEqual("arg1");
      expect(data[1][1]).toEqual("arg2");
      client.destroy();
    });

    test("can get information about connections connected to other servers", async () => {
      const client = await specHelper.buildConnection();

      const { id, type, canChat } = await api.connections.apply(client.id);
      expect(id).toEqual(client.id);
      expect(type).toEqual("testServer");
      expect(canChat).toEqual(true);
    });

    test("can call remote methods on/about connections connected to other servers", async () => {
      const client = await specHelper.buildConnection();
      //@ts-ignore
      expect(client["auth"]).toBeUndefined();

      const connection = await api.connections.apply(client.id, "set", [
        "auth",
        true,
      ]);
      expect(connection.id).toEqual(client.id);
      //@ts-ignore
      expect(client["auth"]).toEqual(true);
      client.destroy();
    });

    test("can send arbitrary messages to connections connected to other servers", async () => {
      const client = await specHelper.buildConnection();

      const connection = await api.connections.apply(client.id, "sendMessage", {
        message: "hi",
      });
      if (!connection.messages) throw new Error("no connection.messages");
      const message = connection.messages[connection.messages.length - 1];
      expect(message.message).toEqual("hi");
    });

    test("failing RPC calls with a callback will have a failure callback", async () => {
      try {
        await redis.doCluster(
          "api.rpcTestMethod",
          [],
          "A missing clientId",
          true,
        );
        throw new Error("should not get here");
      } catch (error) {
        expect(error.toString()).toEqual("Error: RPC Timeout");
      }
    });
  });
});
