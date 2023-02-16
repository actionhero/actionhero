import axios, { AxiosError } from "axios";
import { Process, config } from "./../../../src/index";

const actionhero = new Process();
let url: string;

const toJson = async (string: string) => {
  try {
    return JSON.parse(string);
  } catch (error) {
    return error;
  }
};

jest.mock("./../../../src/config/web.ts", () => ({
  __esModule: true,
  test: {
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
        metadataOptions: {
          serverInformation: true,
          requesterInformation: false,
        },
        fingerprintOptions: {
          cookieKey: "sessionID",
        },
      };
    },
  },
}));

describe("Server: Web", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web!.port;
  });

  afterAll(async () => await actionhero.stop());

  describe("errorCodes", () => {
    test("returnErrorCodes false should still have a status of 200", async () => {
      config.web!.returnErrorCodes = false;
      const response = await axios.delete(url + "/api/");
      expect(response.status).toEqual(200);
    });
  });
});
