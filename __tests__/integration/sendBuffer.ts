process.env.AUTOMATIC_ROUTES = "get";

import axios from "axios";
import * as stream from "stream";
import { api, Process, config } from "./../../src/index";

const actionhero = new Process();
let url: string;

describe("Server: sendBuffer", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web!.port;
  });

  afterAll(async () => await actionhero.stop());

  beforeAll(() => {
    api.actions.versions.sendBufferTest = [1];
    api.actions.actions.sendBufferTest = {
      // @ts-ignore
      1: {
        name: "sendBufferTest",
        description: "sendBufferTest",
        version: 1,
        run: async (data) => {
          const buffer = "Example of data buffer";
          const bufferStream = new stream.PassThrough();
          data.connection!.rawConnection.responseHeaders.push([
            "Content-Disposition",
            "attachment; filename=test.csv",
          ]);
          api.servers.servers.web.sendFile(
            data.connection!,
            // @ts-ignore
            null,
            bufferStream,
            "text/csv",
            buffer.length,
            new Date(),
          );
          data.toRender = false;
          bufferStream.end(buffer);
        },
      },
    };

    api.actions.versions.sendUnknownLengthBufferTest = [1];
    api.actions.actions.sendUnknownLengthBufferTest = {
      // @ts-ignore
      1: {
        name: "sendUnknownLengthBufferTest",
        description: "sendUnknownLengthBufferTest",
        version: 1,
        run: async (data) => {
          const bufferStream = new stream.PassThrough();
          api.servers.servers.web.sendFile(
            data.connection!,
            // @ts-ignore
            null,
            bufferStream,
            "text/plain",
            null,
            new Date(),
          );
          const buffer = "Example of unknown length data buffer";
          data.toRender = false;
          bufferStream.end(buffer);
        },
      },
    };

    api.routes.loadRoutes();
  });

  afterAll(() => {
    delete api.actions.actions.sendBufferTest;
    delete api.actions.versions.sendBufferTest;
    delete api.actions.versions.sendUnknownLengthBufferTest;
    delete api.actions.versions.sendUnknownLengthBufferTest;
    api.routes.loadRoutes();
  });

  test("Server should sendBuffer", async () => {
    const response = await axios.get(url + "/api/sendBufferTest");
    expect(response.data).toEqual("Example of data buffer");
  });

  test("Server should send a stream with no specified length", async () => {
    const { data, headers } = await axios.get(
      url + "/api/sendUnknownLengthBufferTest",
    );

    expect(headers).not.toHaveProperty("content-length");
    expect(data).toEqual("Example of unknown length data buffer");
  });
});
