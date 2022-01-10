import { config } from "../../src/index";
import { rebuildConfig } from "../../src/modules/config";

describe("config class", () => {
  it("loads config", () => {
    // statically defined
    expect(config.general.cachePrefix).toBe("actionhero:cache:");
    // generated from another config file
    expect(config.web.httpHeaders["X-Powered-By"]).toBe("actionhero");
  });

  it("updates config on 'restart'", () => {
    const port = "2020";
    process.env.PORT = port;
    expect(config.web.port).not.toBe(port);
    rebuildConfig();
    expect(config.web.port).toBe(port);
  });
});
