process.env.AUTOMATIC_ROUTES = "head,get,post,put,delete";

import * as request from "request-promise-native";
import * as fs from "fs";
import * as path from "path";
import { api, Process, config } from "./../../../src/index";

const actionhero = new Process();
let url: string;

describe("Server: Web", () => {
  beforeAll(async () => {
    await actionhero.start();
    url = "http://localhost:" + config.web.port;
  });

  afterAll(async () => await actionhero.stop());

  beforeAll(() => {
    config.web.returnErrorCodes = true;
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
    const options = {
      method: "POST",
      url: `${url}/api/uploadAction`,
      headers: { "Content-Type": "multipart/form-data" },
      formData: {
        file: fs.createReadStream(
          path.join(__dirname, "..", "..", "..", "public", "simple.html")
        ),
        stringParam: "hello world",
      },
    };

    const body = await request.post(options).then(toJson);
    expect(body.params.stringParam).toEqual("hello world");
    expect(body.params.file).toEqual(
      expect.objectContaining({
        originalFilename: "simple.html",
        mimetype: "text/html",
        size: 101,
      })
    );
  });
});

const toJson = async (string: string) => {
  try {
    return JSON.parse(string);
  } catch (error) {
    return error;
  }
};
