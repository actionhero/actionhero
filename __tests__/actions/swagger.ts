process.env.AUTOMATIC_ROUTES = "get";

import { Process, specHelper, config, api } from "./../../src/index";
import { Swagger } from "../../src/actions/swagger";

describe("Action: swagger", () => {
  const actionhero = new Process();
  let originalRoutes: typeof api.routes.routes;

  beforeAll(async () => {
    await actionhero.start();

    originalRoutes = api.routes.routes;
    api.actions.versions.multiParamTestAction = [1];
    api.actions.actions.multiParamTestAction = {
      // @ts-ignore
      1: {
        name: "multiParamTestAction",
        description: "I am a multiple param test action",
        inputs: {
          one: { required: true },
          two: { required: true },
          three: { required: true },
          four: { required: true },
        },
        outputExample: {},
        run: async (data) => {
          if (data.response) data.response.success = true;
        },
      },
    };

    api.routes.loadRoutes({
      get: [
        {
          path: "/v:apiVersion/one/:one/two/:two/three/:three/four/:four",
          action: "multiParamTestAction",
        },
      ],
    });
  });

  afterAll(async () => {
    await actionhero.stop();

    api.routes.routes = originalRoutes;
    delete api.actions.versions.multiParamTestAction;
    delete api.actions.actions.multiParamTestAction;
  });

  test("automatic routes is enabled", () => {
    config.web && expect(config.web.automaticRoutes).toEqual(["get"]);
  });

  test("returns the correct parts", async () => {
    const { paths, basePath, host } = await specHelper.runAction<Swagger>(
      "swagger",
    );

    expect(basePath).toBe("/api/");
    expect(host).toMatch(/localhost/);
    expect(Object.keys(paths).length).toEqual(11); // 10 actions + custom multiParamTestAction path

    const multiParamPath =
      paths["/one/{one}/two/{two}/three/{three}/four/{four}"];
    expect(multiParamPath).toBeDefined();
    expect(multiParamPath.get.summary).toBe(
      "I am a multiple param test action",
    );
    expect(multiParamPath.get.parameters.map((p) => p.name).sort()).toEqual([
      "four",
      "one",
      "three",
      "two",
    ]);
  });
});
