import * as glob from "glob";
import * as path from "path";
import { config, utils } from "./../../src/index";

describe("Utils", () => {
  describe("util.sleep", () => {
    test("it sleeps", async () => {
      const start = new Date().getTime();
      await utils.sleep(100);
      const end = new Date().getTime();
      expect(end - start).toBeGreaterThanOrEqual(99);
      expect(end - start).toBeLessThan(200);
    });
  });

  describe("utils.arrayUnique", () => {
    test("works", () => {
      const a = [1, 2, 3, 3, 4, 4, 4, 5, 5, 5];
      expect(utils.arrayUnique(a)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("utils.collapseObjectToArray", () => {
    test("fails with numerical keys", () => {
      const o = { 0: "a", 1: "b" };
      const response = utils.collapseObjectToArray(o);
      expect(response).toEqual(["a", "b"]);
    });

    test("fails with non-numerical keys", () => {
      const o = { a: 1 };
      const response = utils.collapseObjectToArray(o);
      expect(response).toEqual(false);
    });
  });

  describe("utils.hashMerge", () => {
    const A = { a: 1, b: 2 };
    const B = { b: -2, c: 3 };
    const C = { a: 1, b: { m: 10, n: 11 } };
    const D = { a: 1, b: { n: 111, o: 22, p: {} } };
    const E = { b: {} };
    const N = { b: null } as Record<string, any>;
    const U = { b: undefined } as Record<string, any>;

    test("simple", () => {
      const Z = utils.hashMerge(A, B);
      expect(Z.a).toEqual(1);
      expect(Z.b).toEqual(-2);
      expect(Z.c).toEqual(3);
    });

    test("directional", () => {
      const Z = utils.hashMerge(B, A);
      expect(Z.a).toEqual(1);
      expect(Z.b).toEqual(2);
      expect(Z.c).toEqual(3);
    });

    test("nested", () => {
      const Z = utils.hashMerge(C, D);
      expect(Z.a).toEqual(1);
      expect(Z.b.m).toEqual(10);
      expect(Z.b.n).toEqual(111);
      expect(Z.b.o).toEqual(22);
      expect(Z.b.p).toEqual({});
    });

    test("empty01", () => {
      const Z = utils.hashMerge(E, D);
      expect(Z.a).toEqual(1);
      expect(Z.b.n).toEqual(111);
      expect(Z.b.o).toEqual(22);
      expect(Z.b.p).toEqual({});
    });

    test("empty10", () => {
      const Z = utils.hashMerge(D, E);
      expect(Z.a).toEqual(1);
      expect(Z.b.n).toEqual(111);
      expect(Z.b.o).toEqual(22);
      expect(Z.b.p).toEqual({});
    });

    test("chained", () => {
      const Z = utils.hashMerge(utils.hashMerge(C, E), D);
      expect(Z.a).toEqual(1);
      expect(Z.b.m).toEqual(10);
      expect(Z.b.n).toEqual(111);
      expect(Z.b.o).toEqual(22);
      expect(Z.b.p).toEqual({});
    });

    test("null", () => {
      const Z = utils.hashMerge(A, N);
      expect(Z.a).toEqual(1);
      expect(Z.b).toBeUndefined();
    });

    test("undefined", () => {
      const Z = utils.hashMerge(A, U);
      expect(Z.a).toEqual(1);
      expect(Z.b).toEqual(2);
    });
  });

  describe("eventLoopDelay", () => {
    test("works", async () => {
      const delay = await utils.eventLoopDelay(10000);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThan(1);
    });
  });

  describe("#parseHeadersForClientAddress", () => {
    test("only x-real-ip, port is null", () => {
      const headers = {
        "x-real-ip": "10.11.12.13",
      };
      const { ip, port } = utils.parseHeadersForClientAddress(headers);
      expect(ip).toEqual("10.11.12.13");
      expect(port).toBeFalsy();
    });
    test("load balancer, x-forwarded-for format", () => {
      const headers = {
        "x-forwarded-for": "35.36.37.38",
        "x-forwarded-port": "80",
      };
      const { ip, port } = utils.parseHeadersForClientAddress(headers);
      expect(ip).toEqual("35.36.37.38");
      expect(port).toEqual("80");
    });
  });

  describe("#parseIPv6URI", () => {
    test("address and port", () => {
      const uri = "[2604:4480::5]:8080";
      const parts = utils.parseIPv6URI(uri);
      expect(parts.host).toEqual("2604:4480::5");
      expect(parts.port).toEqual(8080);
    });

    test("address without port", () => {
      const uri = "2604:4480::5";
      const parts = utils.parseIPv6URI(uri);
      expect(parts.host).toEqual("2604:4480::5");
      expect(parts.port).toEqual(80);
    });

    test("full uri", () => {
      const uri = "http://[2604:4480::5]:8080/foo/bar";
      const parts = utils.parseIPv6URI(uri);
      expect(parts.host).toEqual("2604:4480::5");
      expect(parts.port).toEqual(8080);
    });

    test("failing address", () => {
      const uri = "[2604:4480:z:5]:80";
      try {
        const parts = utils.parseIPv6URI(uri);
        console.log(parts);
      } catch (e) {
        expect(e.message).toEqual("failed to parse address");
      }
    });

    test("should parse locally scoped ipv6 URIs without port", () => {
      const uri = "fe80::1ff:fe23:4567:890a%eth2";
      const parts = utils.parseIPv6URI(uri);
      expect(parts.host).toEqual("fe80::1ff:fe23:4567:890a%eth2");
      expect(parts.port).toEqual(80);
    });

    test("should parse locally scoped ipv6 URIs with port", () => {
      const uri = "[fe80::1ff:fe23:4567:890a%eth2]:8080";
      const parts = utils.parseIPv6URI(uri);
      expect(parts.host).toEqual("fe80::1ff:fe23:4567:890a%eth2");
      expect(parts.port).toEqual(8080);
    });
  });

  describe("utils.arrayStartingMatch", () => {
    test("finds matching arrays", () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3, 4, 5];
      const numberResult = utils.arrayStartingMatch(a, b);
      expect(numberResult).toBe(true);

      const c = ["a", "b", "c"];
      const d = ["a", "b", "c", "d", "e"];
      const stringResult = utils.arrayStartingMatch(c, d);
      expect(stringResult).toBe(true);
    });

    test("finds non-matching arrays", () => {
      const a = [1, 3];
      const b = [1, 2, 3, 4, 5];
      const numberResult = utils.arrayStartingMatch(a, b);
      expect(numberResult).toBe(false);

      const c = ["a", "b", "c"];
      const d = ["a", "b", "d", "e"];
      const stringResult = utils.arrayStartingMatch(c, d);
      expect(stringResult).toBe(false);
    });

    test("does not pass with empty arrays; first", () => {
      const a: number[] = [];
      const b = [1, 2, 3, 4, 5];
      const result = utils.arrayStartingMatch(a, b);
      expect(result).toBe(false);
    });

    test("does not pass with empty arrays; second", () => {
      const a = [1, 2, 3, 4, 5];
      const b: number[] = [];
      const result = utils.arrayStartingMatch(a, b);
      expect(result).toBe(false);
    });
  });

  describe("utils.replaceDistWithSrc", () => {
    test("it replaces paths from dist to src", () => {
      const p = `${config.general!.paths.action[0]}/new-actions/test.ts`;
      const withDist = utils.replaceDistWithSrc(p);
      expect(withDist).toMatch("/src/actions/new-actions/test.ts");
    });
  });

  describe("utils.filterObjectForLogging", () => {
    beforeEach(() => {
      config.logger!.maxLogArrayLength = 100;
      expect(config.general!.filteredParams.length).toEqual(0);
    });

    afterEach(() => {
      // after each test, empty the array
      config.general!.filteredParams = [];
      config.logger!.maxLogArrayLength = 10;
    });

    const testInput = {
      p1: 1,
      p2: "s3cr3t",
      o1: {
        o1p1: 1,
        o1p2: "also-s3cr3t",
        o2: {
          o2p1: "this is ok",
          o2p2: "extremely-s3cr3t",
        },
      },
      o2: {
        name: "same as o1`s inner object!",
        o2p1: "nothing secret",
      },
      a1: ["a", "b", "c"],
      a2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    };

    test("can filter top level params, no matter the type", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredParams as string[]).push("p1", "p2", "o2");
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.p1).toEqual("[FILTERED]");
      expect(filteredParams.p2).toEqual("[FILTERED]");
      expect(filteredParams.o2).toEqual("[FILTERED]"); // entire object filtered
      expect(filteredParams.o1).toEqual(testInput.o1); // unchanged
      expect(filteredParams.a1).toEqual(testInput.a1); // unchanged
      expect(filteredParams.a2).toEqual(testInput.a2); // unchanged
    });

    test("will not filter things that do not exist", () => {
      // Identity
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams).toEqual(testInput);

      (config.general!.filteredParams as string[]).push(
        "p3",
        "p4",
        "o1.o3",
        "o1.o2.p1",
      );
      const filteredParams2 = utils.filterObjectForLogging(inputs);
      expect(filteredParams2).toEqual(testInput);
      expect(filteredParams.a1).toEqual(testInput.a1); // unchanged
      expect(filteredParams.a2).toEqual(testInput.a2); // unchanged
    });

    test("can filter a single level dot notation", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredParams as string[]).push(
        "p1",
        "o1.o1p1",
        "somethingNotExist",
      );
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.p1).toEqual("[FILTERED]");
      expect(filteredParams.o1.o1p1).toEqual("[FILTERED]");
      // Unchanged things
      expect(filteredParams.p2).toEqual(testInput.p2);
      expect(filteredParams.o1.o1p2).toEqual(testInput.o1.o1p2);
      expect(filteredParams.o1.o2).toEqual(testInput.o1.o2);
      expect(filteredParams.o2).toEqual(testInput.o2);
      expect(filteredParams.a1).toEqual(testInput.a1);
      expect(filteredParams.a2).toEqual(testInput.a2);
    });

    test("can filter two levels deep", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredParams as string[]).push(
        "p2",
        "o1.o2.o2p1",
        "o1.o2.notThere",
      );
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.p2).toEqual("[FILTERED]");
      expect(filteredParams.o1.o2.o2p1).toEqual("[FILTERED]");
      // Unchanged things
      expect(filteredParams.p1).toEqual(testInput.p1);
      expect(filteredParams.o1.o1p1).toEqual(testInput.o1.o1p1);
      expect(filteredParams.o1.o2.o2p2).toEqual(testInput.o1.o2.o2p2);
      expect(filteredParams.a1).toEqual(testInput.a1);
      expect(filteredParams.a2).toEqual(testInput.a2);
    });

    test("can filter with a function rather than an array", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      config.general!.filteredParams = () => {
        return ["p1", "p2", "o2"];
      };

      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.p1).toEqual("[FILTERED]");
      expect(filteredParams.p2).toEqual("[FILTERED]");
      expect(filteredParams.o2).toEqual("[FILTERED]"); // entire object filtered
      // Unchanged things
      expect(filteredParams.o1).toEqual(testInput.o1);
      expect(filteredParams.a1).toEqual(testInput.a1);
      expect(filteredParams.a2).toEqual(testInput.a2);
    });

    test("short arrays will be displayed as-is", () => {
      config.logger!.maxLogArrayLength = 100;
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.a1).toEqual(testInput.a1);
      expect(filteredParams.a2).toEqual(testInput.a2);
    });

    test("long arrays will be collected", () => {
      config.logger!.maxLogArrayLength = 10;
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      const filteredParams = utils.filterObjectForLogging(inputs);
      expect(filteredParams.a1).toEqual(testInput.a1);
      expect(filteredParams.a2).toEqual("11 items");
    });
  });

  describe("utils.filterResponseForLogging", () => {
    beforeEach(() => {
      config.logger!.maxLogArrayLength = 100;
      expect(config.general!.filteredResponse.length).toEqual(0);
    });

    afterEach(() => {
      // after each test, empty the array
      config.general!.filteredResponse = [];
      config.logger!.maxLogArrayLength = 10;
    });

    const testInput = {
      p1: 1,
      p2: "s3cr3t",
      o1: {
        o1p1: 1,
        o1p2: "also-s3cr3t",
        o2: {
          o2p1: "this is ok",
          o2p2: "extremely-s3cr3t",
        },
      },
      o2: {
        name: "same as o1`s inner object!",
        o2p1: "nothing secret",
      },
      a1: ["a", "b", "c"],
      a2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    };

    test("can filter top level params, no matter the type", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredResponse as string[]).push("p1", "p2", "o2");
      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse.p1).toEqual("[FILTERED]");
      expect(filteredResponse.p2).toEqual("[FILTERED]");
      expect(filteredResponse.o2).toEqual("[FILTERED]"); // entire object filtered
      expect(filteredResponse.o1).toEqual(testInput.o1); // unchanged
      expect(filteredResponse.a1).toEqual(testInput.a1); // unchanged
      expect(filteredResponse.a2).toEqual(testInput.a2); // unchanged
    });

    test("will not filter things that do not exist", () => {
      // Identity
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse).toEqual(testInput);

      (config.general!.filteredResponse as string[]).push(
        "p3",
        "p4",
        "o1.o3",
        "o1.o2.p1",
      );
      const filteredResponse2 = utils.filterResponseForLogging(inputs);
      expect(filteredResponse2).toEqual(testInput);
      expect(filteredResponse2.a1).toEqual(testInput.a1); // unchanged
      expect(filteredResponse2.a2).toEqual(testInput.a2); // unchanged
    });

    test("can filter a single level dot notation", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredResponse as string[]).push(
        "p1",
        "o1.o1p1",
        "somethingNotExist",
      );
      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse.p1).toEqual("[FILTERED]");
      expect(filteredResponse.o1.o1p1).toEqual("[FILTERED]");
      // Unchanged things
      expect(filteredResponse.p2).toEqual(testInput.p2);
      expect(filteredResponse.o1.o1p2).toEqual(testInput.o1.o1p2);
      expect(filteredResponse.o1.o2).toEqual(testInput.o1.o2);
      expect(filteredResponse.o2).toEqual(testInput.o2);
      expect(filteredResponse.a1).toEqual(testInput.a1);
      expect(filteredResponse.a2).toEqual(testInput.a2);
    });

    test("can filter two levels deep", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      (config.general!.filteredResponse as string[]).push(
        "p2",
        "o1.o2.o2p1",
        "o1.o2.notThere",
      );
      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse.p2).toEqual("[FILTERED]");
      expect(filteredResponse.o1.o2.o2p1).toEqual("[FILTERED]");
      // Unchanged things
      expect(filteredResponse.p1).toEqual(testInput.p1);
      expect(filteredResponse.o1.o1p1).toEqual(testInput.o1.o1p1);
      expect(filteredResponse.o1.o2.o2p2).toEqual(testInput.o1.o2.o2p2);
      expect(filteredResponse.a1).toEqual(testInput.a1);
      expect(filteredResponse.a2).toEqual(testInput.a2);
    });

    test("can filter with a function rather than an array", () => {
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      config.general!.filteredResponse = () => {
        return ["p1", "p2", "o2"];
      };

      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse.p1).toEqual("[FILTERED]");
      expect(filteredResponse.p2).toEqual("[FILTERED]");
      expect(filteredResponse.o2).toEqual("[FILTERED]"); // entire object filtered
      expect(filteredResponse.o1).toEqual(testInput.o1); // unchanged
      expect(filteredResponse.a1).toEqual(testInput.a1);
      expect(filteredResponse.a2).toEqual(testInput.a2);
    });

    test("long arrays will be collected", () => {
      config.logger!.maxLogArrayLength = 10;
      const inputs = JSON.parse(JSON.stringify(testInput)); // quick deep Clone
      const filteredResponse = utils.filterResponseForLogging(inputs);
      expect(filteredResponse.a1).toEqual(testInput.a1);
      expect(filteredResponse.a2).toEqual("11 items");
    });

    test("safeGlobSync to match normal glob.sync", () => {
      const directory = __dirname; // if it is windows platform includes backslash (\\)
      const pattern = "/**/*.ts";
      const normalResult = glob.sync(directory.replace(/\\/g, "/") + pattern); // do not use path.join

      const safeResult = utils.safeGlobSync(path.join(directory, pattern));

      expect(normalResult).toEqual(safeResult);
    });
  });
});
