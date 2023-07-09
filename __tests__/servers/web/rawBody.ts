import { PassThrough } from "stream";
import axios, { AxiosError } from "axios";
import { api, Process, config } from "./../../../src/index";

const actionhero = new Process();
let url: string;

jest.mock("./../../../src/config/web.ts", () => ({
  __esModule: true,
  test: {
    web: () => {
      return {
        enabled: true,
        saveRawBody: true,
        automaticRoutes: ["post"],
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

  describe("connection.rawConnection.rawBody", () => {
    beforeAll(() => {
      api.actions.versions.paramTestAction = [1];
      api.actions.actions.paramTestAction = {
        // @ts-ignore
        1: {
          name: "paramTestAction",
          description: "I return connection.rawConnection.params",
          version: 1,
          run: async (data) => {
            data.response = data.connection!.rawConnection.params;
            if (data.connection!.rawConnection.params.rawBody) {
              data.response!.rawBody =
                data.connection!.rawConnection.params.rawBody.toString();
            }
          },
        },
      };

      api.routes.loadRoutes();
    });

    afterAll(() => {
      delete api.actions.actions.paramTestAction;
      delete api.actions.versions.paramTestAction;
    });

    test(".rawBody will contain the raw POST body without parsing", async () => {
      const requestBody = '{"key":      "value"}';
      const response = await axios.post(
        url + "/api/paramTestAction",
        requestBody,
        {
          headers: { "Content-type": "application/json" },
        },
      );
      expect(response.data.body.key).toEqual("value");
      expect(response.data.rawBody).toEqual('{"key":      "value"}');
    });

    describe("invalid/improper mime types", () => {
      test(".body will be empty if the content-type cannot be handled by formidable and not crash", async () => {
        const requestBody = "<texty>this is like xml</texty>";
        const response = await axios.post(
          url + "/api/paramTestAction",
          requestBody,
          {
            headers: { "Content-type": "text/xml" },
          },
        );
        expect(response.data.body).toEqual({});
        expect(response.data.rawBody).toEqual(requestBody);
      });

      // TODO: mime types with axios are too strong
      test.skip("will set the body properly if mime type is wrong (bad header)", async () => {
        const requestBody = "<texty>this is like xml</texty>";
        const response = await axios.post(
          url + "/api/paramTestAction",
          requestBody,
          {
            headers: { "Content-type": "application/json" },
          },
        );
        expect(response.data.body).toEqual({});
        expect(response.data.rawBody).toEqual(requestBody);
      });

      test("will set the body properly if mime type is wrong (text)", async () => {
        const requestBody = "I am normal \r\n text with \r\n line breaks";
        const response = await axios.post(
          url + "/api/paramTestAction",
          requestBody,
          {
            headers: { "Content-type": "text/plain" },
          },
        );
        expect(response.data.body).toEqual({});
        expect(response.data.rawBody).toEqual(requestBody);
      });

      // TODO Axios doesn't pipe
      test.skip("rawBody will exist if the content-type cannot be handled by formidable", async () => {
        const requestPart1 = "<texty><innerNode>more than";
        const requestPart2 = " two words</innerNode></texty>";

        const bufferStream = new PassThrough();
        const req = axios.post(url + "/api/paramTestAction", {
          headers: { "Content-type": "text/xml" },
        });
        bufferStream.write(Buffer.from(requestPart1)); // write the first part
        // @ts-ignore (we are not await-ing)
        bufferStream.pipe(req);

        setTimeout(() => {
          bufferStream.end(Buffer.from(requestPart2)); // end signals no more is coming
        }, 50);

        await new Promise((resolve, reject) => {
          bufferStream.on("finish", resolve);
        });

        const { data } = await req;
        expect(data.error).toBeUndefined();
        expect(data.body).toEqual({});
        expect(data.rawBody).toEqual(requestPart1 + requestPart2);
      });

      // TODO Axios doesn't pipe
      test.skip("rawBody and form will process JSON with odd stream testing", async () => {
        const requestJson = { a: 1, b: "two" };
        const requestString = JSON.stringify(requestJson);
        const middleIdx = Math.floor(requestString.length / 2);
        const requestPart1 = requestString.substring(0, middleIdx);
        const requestPart2 = requestString.substring(middleIdx);

        const bufferStream = new PassThrough();
        const req = axios.post(url + "/api/paramTestAction", {
          headers: { "Content-type": "application/json" },
        });
        bufferStream.write(Buffer.from(requestPart1)); // write the first part
        // @ts-ignore (we are not await-ing)
        bufferStream.pipe(req);

        setTimeout(() => {
          bufferStream.end(Buffer.from(requestPart2)); // end signals no more is coming
        }, 50);

        await new Promise((resolve, reject) => {
          bufferStream.on("finish", resolve);
        });

        const { data } = await req;
        expect(data.error).toBeUndefined();
        expect(data.body).toEqual(requestJson);
        expect(data.rawBody).toEqual(requestString);
      });

      // TODO Axios doesn't pipe
      test.skip("rawBody processing will not hang on writable error", async () => {
        const requestPart1 = "<texty><innerNode>more than";

        const bufferStream = new PassThrough();
        const req = axios.post(url + "/api/paramTestAction", {
          headers: { "Content-type": "text/xml" },
        });
        bufferStream.write(Buffer.from(requestPart1)); // write the first part
        // @ts-ignore (we are not await-ing)
        bufferStream.pipe(req);

        setTimeout(() => {
          // bufferStream.destroy(new Error('This stream is broken.')) // sends an error and closes the stream
          bufferStream.end();
        }, 50);

        await new Promise((resolve, reject) => {
          bufferStream.on("finish", resolve);
        });

        const { data } = await req;
        expect(data.error).toBeUndefined();
        expect(data.body).toEqual({});
        expect(data.rawBody).toEqual(requestPart1); // stream ends with only one part processed
      });
    });
  });
});
