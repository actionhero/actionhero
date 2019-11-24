import * as request from "request-promise-native";
import { Process, config } from "./../../../src/index";

const actionhero = new Process();
let api;
let url;

const toJson = async string => {
  try {
    return JSON.parse(string);
  } catch (error) {
    return error;
  }
};

jest.mock("./../../../src/config/servers/web.ts", () => ({
  __esModule: true,
  test: {
    servers: {
      web: () => {
        return {
          returnErrorCodes: false,
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
    api = await actionhero.start();
    url = "http://localhost:" + config.servers.web.port;
  });

  afterAll(async () => {
    await actionhero.stop();
  });

  describe("errorCodes", () => {
    test("returnErrorCodes false should still have a status of 200", async () => {
      config.servers.web.returnErrorCodes = false;
      const response = await request.del(url + "/api/", {
        resolveWithFullResponse: true
      });
      expect(response.statusCode).toEqual(200);
    });
  });
});
