import * as path from "path";
import * as ChildProcess from "child_process";

process.env.ACTIONHERO_CONFIG_OVERRIDES = JSON.stringify({
  plugins: {
    testPlugin: {
      path: path.join(__dirname, "..", "..", "testPlugin"),
      actions: false,
      tasks: false,
      servers: false,
      initializers: false,
      public: false,
      cli: false,
    },
  },
});

import { api, Process, specHelper } from "../../../src/index";

const actionhero = new Process();

async function exec(
  command: string,
  args: Record<string, any>,
): Promise<{
  error?: NodeJS.ErrnoException;
  stdout?: string;
  stderr?: string;
}> {
  return new Promise((resolve, reject) => {
    ChildProcess.exec(command, args, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      return resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

describe("Core: Plugins", () => {
  describe("with plugin sections ignored", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      await actionhero.stop();
    });

    test("will not load an action from an un-loaded plugin", async () => {
      const response = await specHelper.runAction("pluginAction");
      expect(response.error).toMatch(/unknown action or invalid apiVersion/);
    });

    test("will not load a task from an un-loaded plugin", () => {
      expect(api.tasks.tasks.pluginTask).not.toBeTruthy();
      expect(api.tasks.jobs.pluginTask).not.toBeTruthy();
    });

    test("will not load an initializer from an un-loaded plugin", () => {
      expect(api.pluginInitializer).not.toBeTruthy();
    });

    // test('will not load a server from an un-loaded plugin')

    test("will not serve static files from an un-loaded plugin", async () => {
      const file = await specHelper.getStaticFile("plugin.html");
      expect(file.error).toMatch(/file is not found/);
    });

    test(
      "will not load CLI command from an un-loaded plugin",
      async () => {
        const { stdout: helpResponse, stderr: error1 } = await exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts help",
          { env: process.env },
        );
        expect(error1).toEqual("");
        expect(helpResponse).not.toContain("hello");

        try {
          await exec(
            "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello",
            { env: process.env },
          );
          throw new Error("should not get here");
        } catch (error) {
          expect(error.toString()).toMatch(/unknown command 'hello'/);
        }
      },
      30 * 1000,
    );
  });
});
