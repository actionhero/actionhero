import * as request from "request-promise-native";
import { Process, config } from "./../../../../src/index";

const actionhero = new Process();
let url;

jest.mock("./../../../../src/config/servers/web.ts", () => ({
  __esModule: true,
  test: {
    servers: {
      web: () => {
        return {
          enabled: true,
          secure: false,
          urlPathForActions: "namespace/actions",
          urlPathForFiles: "namespace/files",
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
  },
}));

describe("Server: Web", () => {
  describe("Routes", () => {
    beforeAll(async () => {
      await actionhero.start();
      url = "http://localhost:" + config.servers.web.port;
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    describe("simple routing", () => {
      describe("deep routes", () => {
        test("old action routes stop working", async () => {
          try {
            await request.get(url + "/api/randomNumber");
            throw new Error("should not get here");
          } catch (error) {
            expect(error.statusCode).toEqual(404);
          }
        });

        test("can ask for nested URL actions", async () => {
          const response = await request.get(
            url + "/namespace/actions/randomNumber",
            { resolveWithFullResponse: true }
          );
          expect(response.statusCode).toEqual(200);
        });

        test("old file routes stop working", async () => {
          try {
            await request.get(url + "/public/simple.html");
            throw new Error("should not get here");
          } catch (error) {
            expect(error.statusCode).toEqual(404);
          }
        });

        test("can ask for nested URL files", async () => {
          const response = await request.get(
            url + "/namespace/files/simple.html",
            { resolveWithFullResponse: true }
          );
          expect(response.statusCode).toEqual(200);
          expect(response.body).toContain("<h1>Actionhero</h1>");
        });

        test("can ask for nested URL files with depth", async () => {
          const response = await request.get(
            url + "/namespace/files/css/cosmo.css",
            { resolveWithFullResponse: true }
          );
          expect(response.statusCode).toEqual(200);
        });

        test("root route files still work", async () => {
          const response = await request.get(url + "/simple.html", {
            resolveWithFullResponse: true,
          });
          expect(response.statusCode).toEqual(200);
          expect(response.body).toContain("<h1>Actionhero</h1>");
        });
      });
    });
  });
});
