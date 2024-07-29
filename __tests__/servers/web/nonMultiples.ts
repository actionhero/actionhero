import axios from "axios";
import { api, Process, config } from "./../../../src/index";
import * as FormData from "form-data";

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
        formOptions: { multiples: false },
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
          inputs: { key: { required: true } },
          run: async (data) => {
            data.response!.data = data.params;
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
      var bodyFormData = new FormData();
      bodyFormData.append("key", "value");
      bodyFormData.append("key", "value1");

      const response = await axios.post(
        url + "/api/paramTestAction",
        bodyFormData,
        {
          headers: { "Content-type": "multipart/form-data" },
        },
      );
      expect(response.data.data.key).toEqual("value1");
    });
  });
});
