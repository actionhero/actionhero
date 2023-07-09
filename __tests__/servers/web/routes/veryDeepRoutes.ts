import axios, { AxiosError } from "axios";
import { Process, config } from "./../../../../src/index";

const actionhero = new Process();
let url: string;

jest.mock("./../../../../src/config/web.ts", () => ({
  __esModule: true,
  test: {
    web: () => {
      return {
        enabled: true,
        secure: false,
        urlPathForActions: "/craz/y/action/path",
        urlPathForFiles: "/a/b/c",
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
  describe("Routes", () => {
    beforeAll(async () => {
      await actionhero.start();
      url = "http://localhost:" + config.web!.port;
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    describe("simple routing", () => {
      describe("very deep routes", () => {
        test("old action routes stop working", async () => {
          try {
            await axios.get(url + "/api/randomNumber");
            throw new Error("should not get here");
          } catch (error) {
            if (error instanceof AxiosError) {
              expect(error.response?.status).toEqual(404);
            } else throw error;
          }
        });

        test("can ask for nested URL actions", async () => {
          const response = await axios.get(
            url + "/craz/y/action/path/randomNumber",
          );
          expect(response.status).toEqual(200);
        });

        test("old file routes stop working", async () => {
          try {
            await axios.get(url + "/public/simple.html");
            throw new Error("should not get here");
          } catch (error) {
            if (error instanceof AxiosError) {
              expect(error.response?.status).toEqual(404);
            } else throw error;
          }
        });

        test("can ask for nested URL files", async () => {
          const response = await axios.get(url + "/a/b/c/simple.html");
          expect(response.status).toEqual(200);
          expect(response.data).toContain("<h1>Actionhero</h1>");
        });

        test("can ask for nested URL files with depth", async () => {
          const response = await axios.get(url + "/a/b/c/css/cosmo.css");
          expect(response.status).toEqual(200);
        });

        test("root route files still work", async () => {
          const response = await axios.get(url + "/simple.html");
          expect(response.status).toEqual(200);
          expect(response.data).toContain("<h1>Actionhero</h1>");
        });
      });
    });
  });
});
