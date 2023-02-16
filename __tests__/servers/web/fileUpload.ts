process.env.AUTOMATIC_ROUTES = "head,get,post,put,delete";
// process.env.LOG_LEVEL = "info";

import axios, { AxiosError } from "axios";
import * as FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import { api, Process, config } from "./../../../src/index";
import { sleep } from "../../../src/modules/utils/sleep";

describe("Server: Web", () => {
  const actionhero = new Process();
  let url: string;

  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web!.port;
  });

  afterAll(async () => await actionhero.stop());

  beforeAll(() => {
    config.web!.returnErrorCodes = true;
    api.actions.versions.uploadAction = [1];
    api.actions.actions.uploadAction = {
      // @ts-ignore
      1: {
        name: "uploadAction",
        description: "I am a test",
        version: 1,
        inputs: {
          file: { required: true },
          stringParam: { required: true },
        },
        outputExample: {},
        run: async (data) => {
          await sleep(1000 * 1);
          return { params: data.params };
        },
      },
    };

    api.routes.loadRoutes();
  });

  afterAll(() => {
    delete api.actions.actions.uploadAction;
    delete api.actions.versions.uploadAction;
  });

  test("files can be uploaded", async () => {
    const form = new FormData();
    form.append("stringParam", "hello world");
    form.append(
      "file",
      fs.createReadStream(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "public",
          "logo",
          "actionhero.png"
        )
      )
    );

    const response = await axios.post(`${url}/api/uploadAction`, form);
    expect(response.data.params.stringParam).toEqual("hello world");
    expect(response.data.params.file).toEqual(
      expect.objectContaining({
        originalFilename: "actionhero.png",
        mimetype: "image/png",
        size: 59273,
      })
    );
  });
});
