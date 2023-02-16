import axios, { AxiosError } from "axios";
import { Process, config } from "./../../../src/index";

const actionhero = new Process();
let url: string;

jest.mock("./../../../src/config/web.ts", () => ({
  __esModule: true,
  test: {
    web: () => {
      return {
        enabled: true,
        automaticRoutes: ["get", "post"],
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

  describe("JSONp", () => {
    test("can ask for JSONp responses", async () => {
      const response = await axios.get(
        url + "/api/randomNumber?callback=myCallback"
      );
      expect(response.data).toContain("myCallback({");
      expect(response.data).toContain("Your random number is");
    });

    test("JSONp responses cannot be used for XSS", async () => {
      const response = await axios.get(
        url + "/api/randomNumber?callback=alert(%27hi%27);foo"
      );
      expect(response.data).not.toMatch(/alert\(/);
      expect(response.data.indexOf("alert&#39;hi&#39;;foo(")).toEqual(0);
    });
  });
});
