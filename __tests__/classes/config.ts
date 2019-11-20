import { config } from "../../src/classes/config";

describe("config class", () => {
  it("loads config", () => {
    expect(config.general).toBeTruthy();
  });
});
