import { Process } from "./../../src/index";

const actionhero = new Process();
let api;

describe("Polyfill", () => {
  beforeAll(async () => {
    api = await actionhero.start();
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  test("should have api object with legacy parts", () => {
    [api.utils, api.cache, api.tasks, api.actions, api.resque].forEach(item => {
      expect(item).toBeInstanceOf(Object);
    });

    expect(api.log).toBeInstanceOf(Function);
  });

  test("should be able to use functions through legacy api", async () => {
    const resp = await api.cache.save("legacyKey", "check");
    expect(resp).toEqual(true);

    const { value } = await api.cache.load("legacyKey");
    expect(value).toEqual("check");
  });

  test("config should be available", () => {
    expect(api.config.process.env).toEqual("test");
  });
});
