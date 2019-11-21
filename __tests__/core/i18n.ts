import * as I18n from "i18n";
import * as fs from "fs";
import * as path from "path";
import { Process, config, i18n, utils, specHelper } from "./../../src/index";

const actionhero = new Process();
let api;
let originalDetermineConnectionLocale;

const readLocaleFile = locale => {
  const file = config.general.paths.locale[0] + "/" + locale + ".json";
  const contents = String(fs.readFileSync(file));
  const json = JSON.parse(contents);
  return json;
};

const spanish = {
  "Your random number is {{randomNumber}}":
    "Su número aleatorio es {{randomNumber}}",
  actionhero: {
    errors: {
      missingParams: "{{param}} es un parámetro requerido para esta acción",
      fileNotFound: "Ese archivo no se encuentra"
    }
  }
};

fs.writeFileSync(
  path.join(__dirname, "/../../locales/test-env-es.json"),
  JSON.stringify(spanish, null, 2)
);

describe("Core", () => {
  describe("i18n", () => {
    beforeAll(async () => {
      api = await actionhero.start();
      originalDetermineConnectionLocale = i18n.determineConnectionLocale;

      const options = config.i18n;
      options.directory = config.general.paths.locale[0];
      options.locales = ["test-env-en", "test-env-es"];
      options.defaultLocale = "test-env-en";
      I18n.configure(options);
    });

    afterAll(async () => {
      fs.unlinkSync(path.join(__dirname, "/../../locales/test-env-en.json"));
      fs.unlinkSync(path.join(__dirname, "/../../locales/test-env-es.json"));
      await actionhero.stop();
      api.i18n.determineConnectionLocale = originalDetermineConnectionLocale;
    });

    test("should create localization files by default, and strings from actions should be included", async () => {
      const { randomNumber } = await specHelper.runAction("randomNumber");
      expect(randomNumber).toBeLessThan(1);
      expect(randomNumber).toBeGreaterThanOrEqual(0);

      const content = readLocaleFile("test-env-en");

      ["Your random number is {{randomNumber}}"].forEach(s => {
        expect(content[s]).toEqual(s);
      });
    });

    test("should respect the content of the localization files for generic messages to connections", async () => {
      let response;

      i18n.determineConnectionLocale = () => {
        return "test-env-en";
      };

      response = await specHelper.runAction("randomNumber");
      expect(response.stringRandomNumber).toMatch(/Your random number is/);

      i18n.determineConnectionLocale = () => {
        return "test-env-es";
      };

      response = await specHelper.runAction("randomNumber");
      expect(response.stringRandomNumber).toMatch(/Su número aleatorio es/);
    });

    test("should respect the content of the localization files for api errors to connections or use defaults", async () => {
      let response;
      i18n.determineConnectionLocale = () => {
        return "test-env-en";
      };
      response = await specHelper.runAction("cacheTest");
      expect(response.error).toEqual("Error: actionhero.errors.missingParams");

      i18n.determineConnectionLocale = () => {
        return "test-env-es";
      };
      response = await specHelper.runAction("cacheTest");
      expect(response.error).toMatch(
        /key es un parámetro requerido para esta acción/
      );
    });

    test("should respect the content of the localization files for http errors to connections or use defaults", async () => {
      let response;
      i18n.determineConnectionLocale = () => {
        return "test-env-en";
      };
      response = await specHelper.getStaticFile("missing-file.html");
      expect(response.error).toEqual("actionhero.errors.fileNotFound");

      i18n.determineConnectionLocale = () => {
        return "test-env-es";
      };
      response = await specHelper.getStaticFile("missing-file.html");
      expect(response.error).toMatch(/Ese archivo no se encuentra/);
    });

    test("determineConnectionLocale cannot be an async method", async () => {
      i18n.determineConnectionLocale = async () => {
        await utils.sleep(1);
        return "test-env-es";
      };

      const response = await specHelper.getStaticFile("missing-file.html");
      expect(response.error).toMatch(/actionhero.errors.fileNotFound/); // should this have worked, it would have been in Spanish
    });
  });
});
