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
          allowedRequestHosts: ["https://www.site.com"],
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

  describe("request redirection (allowedRequestHosts)", () => {
    test("will redirect clients if they do not request the proper host", async () => {
      try {
        await request.get({
          followRedirect: false,
          url: url + "/api/randomNumber",
          headers: { Host: "lalala.site.com" }
        });
        throw new Error("should not get here");
      } catch (error) {
        expect(error.statusCode).toEqual(302);
        expect(error.response.body).toMatch(
          /You are being redirected to https:\/\/www.site.com\/api\/randomNumber/
        );
      }
    });

    test("will allow API access from the proper hosts", async () => {
      const response = await request.get({
        followRedirect: false,
        url: url + "/api/randomNumber",
        headers: {
          Host: "www.site.com",
          "x-forwarded-proto": "https"
        }
      });

      expect(response).toMatch(/randomNumber/);
    });
  });
});
