import { Config } from "../../src/classes/config";

describe("config class", () => {
  it("loads config", () => {
    expect(Config.general).toBeTruthy();
  });
});
