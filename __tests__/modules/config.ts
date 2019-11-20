import { config } from "../../src/index";

describe("config class", () => {
  it("loads config", () => {
    expect(config.general).toBeTruthy();
  });
});
