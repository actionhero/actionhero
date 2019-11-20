import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Process, Cache, id } from "./../../src/index";
import { sleep } from "./../../src/utils/sleep";

const actionhero = new Process();
let api;

describe("Core", () => {
  describe("cache", () => {
    beforeAll(async () => {
      api = await actionhero.start();
    });
    afterAll(async () => {
      await actionhero.stop();
    });

    beforeAll(async () => {
      await api.redis.clients.client.flushdb();
    });

    test("cache methods should exist", () => {
      expect(Cache.save).toBeInstanceOf(Function);
      expect(Cache.load).toBeInstanceOf(Function);
      expect(Cache.destroy).toBeInstanceOf(Function);
    });

    test("cache.save", async () => {
      const resp = await Cache.save("testKey", "abc123");
      expect(resp).toEqual(true);
    });

    test("cache.load", async () => {
      await Cache.save("testKey", "abc123");
      const { value } = await Cache.load("testKey");
      expect(value).toEqual("abc123");
    });

    test("cache.load failures", async () => {
      try {
        await Cache.load("something else");
        throw new Error("should not get here");
      } catch (error) {
        expect(String(error)).toEqual("Error: Object not found");
      }
    });

    test("cache.destroy", async () => {
      const resp = await Cache.destroy("testKey");
      expect(resp).toEqual(true);
    });

    test("cache.destroy failure", async () => {
      const resp = await Cache.destroy("testKey");
      expect(resp).toEqual(false);
    });

    test("cache.save with expire time", async () => {
      const resp = await Cache.save("testKey", "abc123", 10);
      expect(resp).toEqual(true);
    });

    test("cache.load with expired items should not return them", async () => {
      const saveResp = await Cache.save("testKey_slow", "abc123", 10);
      expect(saveResp).toEqual(true);
      await sleep(20);
      try {
        await Cache.load("testKey_slow");
        throw new Error("should not get here");
      } catch (error) {
        expect(String(error)).toEqual("Error: Object expired");
      }
    });

    test("cache.load with negative expire times will never load", async () => {
      const saveResp = await Cache.save("testKeyInThePast", "abc123", -1);
      expect(saveResp).toEqual(true);
      try {
        await Cache.load("testKeyInThePast");
        throw new Error("should not get here");
      } catch (error) {
        expect(String(error)).toMatch(/Error: Object/);
      }
    });

    test("cache.save does not need to pass expireTime", async () => {
      const saveResp = await Cache.save("testKeyForNullExpireTime", "abc123");
      expect(saveResp).toEqual(true);
      const { value } = await Cache.load("testKeyForNullExpireTime");
      expect(value).toEqual("abc123");
    });

    test("cache.load without changing the expireTime will re-apply the redis expire", async () => {
      const key = "testKey";
      await Cache.save(key, "val", 1000);
      const loadResp = await Cache.load(key);
      expect(loadResp.value).toEqual("val");
      await sleep(1001);
      try {
        await Cache.load(key);
        throw new Error("should not get here");
      } catch (error) {
        // expect(String(error)).toMatch(/Error: Object expired/)
        expect(error).toBeTruthy();
      }
    });

    test("cache.load with options that extending expireTime should return cached item", async () => {
      const expireTime = 400;
      const timeout = 200;

      // save the initial key
      const saveResp = await Cache.save("testKey_slow", "abc123", expireTime);
      expect(saveResp).toEqual(true);

      // wait for `timeout` and try to load the key
      await sleep(timeout);

      let loadResp = await Cache.load("testKey_slow", {
        expireTimeMS: expireTime
      });
      expect(loadResp.value).toEqual("abc123");

      // wait another `timeout` and load the key again within the extended expire time
      await sleep(timeout);

      loadResp = await Cache.load("testKey_slow");
      expect(loadResp.value).toEqual("abc123");

      // wait another `timeout` and the key load should fail without the extension
      await sleep(timeout);

      try {
        loadResp = await Cache.load("testKey_slow");
        throw new Error("should not get here");
      } catch (error) {
        expect(String(error)).toEqual("Error: Object expired");
      }
    });

    test("cache.save works with arrays", async () => {
      const saveResp = await Cache.save("array_key", [1, 2, 3]);
      expect(saveResp).toEqual(true);
      const { value } = await Cache.load("array_key");
      expect(value[0]).toEqual(1);
      expect(value[1]).toEqual(2);
      expect(value[2]).toEqual(3);
    });

    test("cache.save works with objects", async () => {
      const data: {
        [key: string]: any;
      } = {};

      data.thing = "stuff";
      data.otherThing = [1, 2, 3];
      const saveResp = await Cache.save("obj_key", data);
      expect(saveResp).toEqual(true);
      const { value } = await Cache.load("obj_key");
      expect(value.thing).toEqual("stuff");
      expect(value.otherThing[0]).toEqual(1);
      expect(value.otherThing[1]).toEqual(2);
      expect(value.otherThing[2]).toEqual(3);
    });

    test("can read the cache size", async () => {
      await Cache.save("thingA", {});
      const count = await Cache.size();
      expect(count > 0).toEqual(true);
    });

    test("can clear the cache entirely", async () => {
      await Cache.save("thingA", {});
      let count = await Cache.size();
      expect(count > 0).toEqual(true);
      await Cache.clear();
      count = await Cache.size();
      expect(count).toEqual(0);
    });

    describe("lists", () => {
      test("can push and pop from an array", async () => {
        await Cache.push("testListKey", "a string");
        await Cache.push("testListKey", ["an array"]);
        await Cache.push("testListKey", { what: "an object" });

        let data;
        data = await Cache.pop("testListKey");
        expect(data).toEqual("a string");
        data = await Cache.pop("testListKey");
        expect(data).toEqual(["an array"]);
        data = await Cache.pop("testListKey");
        expect(data).toEqual({ what: "an object" });
        data = await Cache.pop("testListKey");
        expect(data).toBeNull();
      });

      test("will return undefined if the list is empty", async () => {
        const data = await Cache.pop("emptyListKey");
        expect(data).toBeNull();
      });

      test("can get the length of an array when full", async () => {
        await Cache.push("testListKey2", "a string");
        const length = await Cache.listLength("testListKey2");
        expect(length).toEqual(1);
      });

      test("will return 0 length when the key does not exist", async () => {
        const length = await Cache.listLength("testListKey3");
        expect(length).toEqual(0);
      });
    });

    describe("locks", () => {
      const key = "testKey";

      afterEach(async () => {
        Cache.overrideLockName(id);
        await Cache.unlock(key);
      });

      test("things can be locked, checked, and unlocked aribitrarily", async () => {
        let lockOk;
        lockOk = await Cache.lock(key, 100);
        expect(lockOk).toEqual(true);
        lockOk = await Cache.checkLock(key);
        expect(lockOk).toEqual(true);
        lockOk = await Cache.unlock(key);
        expect(lockOk).toEqual(true);
        lockOk = await Cache.checkLock(key);
        expect(lockOk).toEqual(true);
      });

      test("locks have a TTL and the default will be assumed from config", async () => {
        const lockOk = await Cache.lock(key, undefined);
        expect(lockOk).toEqual(true);
        const ttl = await api.redis.clients.client.ttl(Cache.lockPrefix + key);
        expect(ttl).toBeGreaterThanOrEqual(9);
        expect(ttl).toBeLessThanOrEqual(10);
      });

      test("you can save an item if you do hold the lock", async () => {
        const lockOk = await Cache.lock(key);
        expect(lockOk).toEqual(true);
        const success = await Cache.save(key, "value");
        expect(success).toEqual(true);
      });

      test("you cannot save a locked item if you do not hold the lock", async () => {
        const lockOk = await Cache.lock(key);
        expect(lockOk).toEqual(true);
        // Cache.lockName = "otherId";
        Cache.overrideLockName("otherId");
        try {
          await Cache.save(key, "value");
          throw new Error("should not get here");
        } catch (error) {
          expect(String(error)).toEqual("Error: Object locked");
        }
      });

      test("you cannot destroy a locked item if you do not hold the lock", async () => {
        const lockOk = await Cache.lock(key);
        expect(lockOk).toEqual(true);
        Cache.overrideLockName("otherId");
        try {
          await Cache.destroy(key);
          throw new Error("should not get here");
        } catch (error) {
          expect(String(error)).toEqual("Error: Object locked");
        }
      });

      test("you can opt to retry to obtain a lock if a lock is held (READ)", async () => {
        const success = await Cache.save(key, "value");
        expect(success).toEqual(true);
        let lockOk = await Cache.lock(key, 1); // will be rounded up to 1s
        expect(lockOk).toEqual(true);

        Cache.overrideLockName("otherId");
        lockOk = await Cache.checkLock(key);
        expect(lockOk).toEqual(false);

        const start = new Date().getTime();
        const { value } = await Cache.load(key, { retry: 2000 });
        expect(value).toEqual("value");
        const delta = new Date().getTime() - start;
        expect(delta >= 1000).toEqual(true);
      });

      describe("locks are actually blocking", () => {
        let originalLockName;

        beforeAll(() => {
          originalLockName = Cache.lockName;
        });
        afterAll(() => {
          Cache.lockName = originalLockName;
        });

        test("locks are actually blocking", async () => {
          const key = "test";
          let lockOk;

          Cache.overrideLockName(`test-name-pass-${1}`);
          lockOk = await Cache.checkLock(key);
          expect(lockOk).toEqual(true);
          await Cache.lock(key, 1000 * 60);

          Cache.overrideLockName(`test-name-pass-${2}`);
          lockOk = await Cache.checkLock(key);
          expect(lockOk).toEqual(false);

          Cache.overrideLockName(`test-name-pass-${3}`);
          lockOk = await Cache.checkLock(key);
          expect(lockOk).toEqual(false);
        });

        test("locks are actually blocking (using setnx value)", async () => {
          const key = "test-setnx";
          let lockOk;

          Cache.overrideLockName(`test-setnx-name-pass-${1}`);
          lockOk = await Cache.lock(key, 1000 * 60);
          expect(lockOk).toEqual(true);

          Cache.overrideLockName(`test-setnx-name-pass-${2}`);
          lockOk = await Cache.lock(key, 1000 * 60);
          expect(lockOk).toEqual(false);

          Cache.overrideLockName(`test-setnx-name-pass-${3}`);
          lockOk = await Cache.lock(key, 1000 * 60);
          expect(lockOk).toEqual(false);
        });
      });
    });

    describe("cache dump files", () => {
      const file = os.tmpdir() + path.sep + "cacheDump";

      test("can read write the cache to a dump file", async () => {
        await Cache.clear();
        await Cache.save("thingA", 123);
        const count = await Cache.dumpWrite(file);
        expect(count).toEqual(1);
        const body = JSON.parse(String(fs.readFileSync(file)));
        const content = JSON.parse(body["actionhero:cache:thingA"]);
        expect(content.value).toEqual(123);
      });

      test("can load the cache from a dump file", async () => {
        await Cache.clear();
        const count = await Cache.dumpRead(file);
        expect(count).toEqual(1);
        const { value } = await Cache.load("thingA");
        expect(value).toEqual(123);
      });
    });
  });
});
