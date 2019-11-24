import * as request from "request-promise-native";
import { Process, config } from "./../../../src/index";

const actionhero = new Process();
let url;

jest.mock("./../../../src/config/servers/web.ts", () => ({
  __esModule: true,
  test: {
    servers: {
      web: () => {
        return {
          enabled: true,
          secure: false,
          urlPathForActions: "api",
          urlPathForFiles: "public",
          rootEndpointType: "file",
          port: 18080 + parseInt(process.env.JEST_WORKER_ID || "0"),
          matchExtensionMime: true,
          simpleRouting: true,
          queryRouting: true,
          metadataOptions: {
            serverInformation: true,
            requesterInformation: false
          },
          fingerprintOptions: {
            cookieKey: "sessionID"
          }
        };
      }
    }
  }
}));

describe("Server: Web", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.servers.web.port;
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  describe("JSONp", () => {
    test("can ask for JSONp responses", async () => {
      const response = await request.get(
        url + "/api/randomNumber?callback=myCallback"
      );
      expect(response.indexOf("myCallback({")).toEqual(0);
      expect(response.indexOf("Your random number is")).toBeGreaterThan(0);
    });

    test("JSONp responses cannot be used for XSS", async () => {
      const response = await request.get(
        url + "/api/randomNumber?callback=alert(%27hi%27);foo"
      );
      expect(response).not.toMatch(/alert\(/);
      expect(response.indexOf("alert&#39;hi&#39;;foo(")).toEqual(0);
    });
  });
});
