import * as path from "path";
import * as ChildProcess from "child_process";

process.env.ACTIONHERO_CONFIG_OVERRIDES = JSON.stringify({
  plugins: {
    testPlugin: { path: path.join(__dirname, "..", "..", "testPlugin") },
  },
});

import { api, Process, specHelper } from "../../../src/index";

const actionhero = new Process();

async function exec(
  command: string,
  args: Record<string, any>
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
  describe("with plugin", () => {
    beforeAll(async () => {
      await actionhero.start();
    });

    afterAll(async () => {
      delete process.env.ACTIONHERO_CONFIG_OVERRIDES;
      await actionhero.stop();
    });

    test("can load an action from a plugin", async () => {
      const response = await specHelper.runAction<any>("pluginAction");
      expect(response.error).toBeUndefined();
      expect(response.cool).toEqual(true);
    });

    test("can load a task from a plugin", () => {
      expect(api.tasks.tasks.pluginTask).toBeTruthy();
      expect(api.tasks.jobs.pluginTask).toBeTruthy();
    });

    test("can load an initializer from a plugin", () => {
      expect(api.pluginInitializer.here).toEqual(true);
    });

    // test('can load a server from a plugin')

    test("can serve static files from a plugin", async () => {
      const file = await specHelper.getStaticFile("plugin.html");
      expect(file.content).toEqual("<h1>PLUGIN!<h1>\n");
      expect(file.mime).toEqual("text/html");
    });

    test(
      "can load CLI command from a plugin",
      async () => {
        const env = { ...process.env };

        const { stdout: helpResponse, stderr: error1 } = await exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts help",
          { env }
        );
        expect(error1).toEqual("");
        expect(helpResponse).toContain("hello");

        const { stdout: helloResponse, stderr: error2 } = await exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello",
          { env }
        );
        expect(error2).toEqual("");
        expect(helloResponse).toContain("Hello, Actionhero");
      },
      30 * 1000
    );
  });
});
