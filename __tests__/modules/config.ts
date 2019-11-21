import { config } from "../../src/index";

describe("config class", () => {
  it("loads config", () => {
    // statically defined
    expect(config.general.cachePrefix).toBe("actionhero:cache:");
    // generated from another config file
    expect(config.servers.web.httpHeaders["X-Powered-By"]).toBe("actionhero");
  });
});
