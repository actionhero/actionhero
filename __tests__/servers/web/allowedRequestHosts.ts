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
        secure: false,
        automaticRoutes: ["get"],
        allowedRequestHosts: ["https://www.site.com"],
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

  describe("request redirection (allowedRequestHosts)", () => {
    test("will redirect clients if they do not request the proper host", async () => {
      try {
        await axios.get(url + "/api/randomNumber", {
          maxRedirects: 0,
          headers: { Host: "lalala.site.com" },
        });
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(302);
          expect(error.response?.data).toMatch(
            /You are being redirected to https:\/\/www.site.com\/api\/randomNumber/,
          );
        } else throw error;
      }
    });

    test("will redirect clients if they do not request the proper protocol", async () => {
      try {
        await axios.get(url + "/api/randomNumber", {
          maxRedirects: 0,
          headers: { Host: "www.site.com" },
        });
        throw new Error("should not get here");
      } catch (error) {
        if (error instanceof AxiosError) {
          expect(error.response?.status).toEqual(302);
          expect(error.response?.data).toMatch(
            /You are being redirected to https:\/\/www.site.com\/api\/randomNumber/,
          );
        } else throw error;
      }
    });

    test("will allow API access from the proper hosts", async () => {
      const response = await axios.get(url + "/api/randomNumber", {
        maxRedirects: 0,
        headers: {
          Host: "www.site.com",
          "x-forwarded-proto": "https",
        },
      });

      expect(response.data["randomNumber"]).not.toBeUndefined();
    });
  });
});
