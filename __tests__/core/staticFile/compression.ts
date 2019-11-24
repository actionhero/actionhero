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
          compress: true,
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

describe("Core", () => {
  describe("static file", () => {
    beforeAll(async () => {
      await actionhero.start();
      url =
        "http://localhost:" +
        config.servers.web.port +
        "/" +
        config.servers.web.urlPathForFiles;
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    describe("Compression", () => {
      test("should respect accept-encoding header priority with gzip as first in a list of encodings", async () => {
        const response = await request.get(url + "/simple.html", {
          headers: { "Accept-Encoding": "gzip, deflate, sdch, br" },
          resolveWithFullResponse: true
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers["content-encoding"]).toEqual("gzip");
      });

      test("should respect accept-encoding header priority with deflate as second in a list of encodings", async () => {
        const response = await request.get(url + "/simple.html", {
          headers: { "Accept-Encoding": "br, deflate, gzip" },
          resolveWithFullResponse: true
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers["content-encoding"]).toEqual("deflate"); // br is not a currently supported encoding
      });

      test("should respect accept-encoding header priority with gzip as only option", async () => {
        const response = await request.get(url + "/simple.html", {
          headers: { "Accept-Encoding": "gzip" },
          resolveWithFullResponse: true
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers["content-encoding"]).toEqual("gzip");
      });

      test("should not encode content without a valid a supported value in accept-encoding header", async () => {
        const response = await request.get(url + "/simple.html", {
          headers: { "Accept-Encoding": "sdch, br" },
          resolveWithFullResponse: true
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers["content-encoding"]).toBeUndefined();
      });

      test("should not encode content without accept-encoding header", async () => {
        const response = await request.get(url + "/simple.html", {
          resolveWithFullResponse: true
        });

        expect(response.statusCode).toEqual(200);
        expect(response.headers["content-encoding"]).toBeUndefined();
      });
    });
  });
});
