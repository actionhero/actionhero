import { Process, specHelper } from "./../../src/index";
import { CacheTest } from "../../src/actions/cacheTest";

describe("Action: Cache", () => {
  const actionhero = new Process();
  beforeAll(async () => await actionhero.start());
  afterAll(async () => await actionhero.stop());

  test("fails with no params", async () => {
    const { error } = await specHelper.runAction<CacheTest>("cacheTest", {});
    expect(error).toEqual("Error: key is a required parameter for this action");
  });

  test("fails with just key", async () => {
    const { error } = await specHelper.runAction<CacheTest>("cacheTest", {
      key: "test key",
    });
    expect(error).toEqual(
      "Error: value is a required parameter for this action"
    );
  });

  test("fails with just value", async () => {
    const { error } = await specHelper.runAction<CacheTest>("cacheTest", {
      value: "abc123",
    });
    expect(error).toEqual("Error: key is a required parameter for this action");
  });

  test("fails with gibberish param", async () => {
    const { error } = await specHelper.runAction<CacheTest>("cacheTest", {
      thingy: "abc123",
    });
    expect(error).toEqual("Error: key is a required parameter for this action");
  });

  test("fails with value shorter than 2 letters", async () => {
    const { error } = await specHelper.runAction<CacheTest>("cacheTest", {
      key: "abc123",
      value: "v",
    });
    expect(error).toEqual("Error: inputs should be at least 3 letters long");
  });

  test("works with correct params", async () => {
    const { cacheTestResults, error } = await specHelper.runAction<CacheTest>(
      "cacheTest",
      {
        key: "testKey",
        value: "abc123",
      }
    );
    expect(error).toBeFalsy();
    expect(cacheTestResults.saveResp).toEqual(true);
    expect(cacheTestResults.loadResp.value).toEqual("abc123");
    expect(cacheTestResults.deleteResp).toEqual(true);
  });
});
