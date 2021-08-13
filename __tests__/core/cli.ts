// Note: These tests will only run on *nix operating systems
// You can use SKIP_CLI_TEST_SETUP=true to skip the setup portion of these tests if you are testing this file repeatedly

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as request from "request-promise-native";
import * as isrunning from "is-running";

const testDir = path.join(process.cwd(), "tmp", "actionheroTestProject");
const binary = "./node_modules/.bin/actionhero";
const pacakgeJSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/../../package.json")).toString()
);

console.log(`testDir: ${testDir}`);

const port = 18080 + parseInt(process.env.JEST_WORKER_ID || "0");
const host = "localhost";
let pid;
let AHPath;

class ErrorWithStd extends Error {
  stderr: string;
  stdout: string;
  pid: number;
  exitCode: number;
}

const doCommand = async (
  command: string,
  useCwd = true,
  extraEnv = {}
): Promise<{
  stderr: string;
  stdout: string;
  pid: number;
  exitCode: number;
}> => {
  return new Promise((resolve, reject) => {
    const parts = command.split(" ");
    const bin = parts.shift();
    const args = parts;
    let stdout = "";
    let stderr = "";

    let env = process.env;
    // we don't want the CLI commands to source typescript files
    // when running jest, it will reset NODE_ENV=test
    delete env.NODE_ENV;
    // but sometimes we do /shrug/
    env = Object.assign(env, extraEnv);

    const cmd = spawn(bin, args, {
      cwd: useCwd ? testDir : __dirname,
      env: env,
    });

    cmd.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    cmd.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pid = cmd.pid;

    cmd.on("close", (exitCode) => {
      if (stderr.length > 0 || exitCode !== 0) {
        const error = new ErrorWithStd(stderr);
        error.stderr = stderr;
        error.stdout = stdout;
        error.pid = pid;
        error.exitCode = exitCode;
        return reject(error);
      }
      return resolve({ stderr, stdout, pid, exitCode });
    });
  });
};

async function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

describe("Core: CLI", () => {
  if (process.platform === "win32") {
    console.log("*** CANNOT RUN CLI TESTS ON WINDOWS.  Sorry. ***");
  } else {
    beforeAll(async () => {
      if (process.env.SKIP_CLI_TEST_SETUP === "true") {
        return;
      }

      const sourcePackage = path.normalize(
        path.join(__dirname, "/../../templates/package.json.template")
      );
      AHPath = path.normalize(path.join(__dirname, "/../.."));

      await doCommand(`rm -rf ${testDir}`, false);
      await doCommand(`mkdir -p ${testDir}`, false);
      await doCommand(`cp ${sourcePackage} ${testDir}/package.json`);

      const data = fs.readFileSync(testDir + "/package.json").toString();
      const result = data.replace(/%%versionNumber%%/g, `file:${AHPath}`);
      fs.writeFileSync(`${testDir}/package.json`, result);
    });

    test("should have made the test dir", () => {
      expect(fs.existsSync(testDir)).toEqual(true);
      expect(fs.existsSync(testDir + "/package.json")).toEqual(true);
    });

    test("can call npm install in the new project", async () => {
      try {
        await doCommand("npm install --ignore-scripts");
      } catch (error) {
        // we might get warnings about package.json locks, etc.  we want to ignore them
        if (error.toString().indexOf("npm") < 0) {
          throw error;
        }
        expect(error.exitCode).toEqual(0);
      }
    }, 120000);

    test("can generate a new project", async () => {
      const { stdout } = await doCommand(`${binary} generate`);
      expect(stdout).toMatch("❤️  the Actionhero Team");

      [
        "tsconfig.json",
        "src/server.ts",
        "src/actions",
        "src/tasks",
        "src/initializers",
        "src/servers",
        "src/bin",
        "src/actions/swagger.ts",
        "src/actions/status.ts",
        "src/config",
        "src/config/api.ts",
        "src/config/errors.ts",
        "src/config/i18n.ts",
        "src/config/plugins.ts",
        "src/config/logger.ts",
        "src/config/redis.ts",
        "src/config/routes.ts",
        "src/config/tasks.ts",
        "src/config/servers",
        "src/config/servers/web.ts",
        "src/config/servers/websocket.ts",
        "pids",
        "log",
        "public",
        "public/index.html",
        "public/chat.html",
        "public/swagger.html",
        "public/css/cosmo.css",
        "public/javascript",
        "public/logo/actionhero.png",
        "__tests__",
        "__tests__/actions/status.ts",
        ".gitignore",
      ].forEach((f) => {
        expect(fs.existsSync(testDir + "/" + f)).toEqual(true);
      });
    }, 20000);

    test("the project can be compiled", async () => {
      const { stdout } = await doCommand(`npm run build`);
      expect(stdout).toMatch("tsc");
    }, 20000);

    test("can call the help command", async () => {
      const { stdout } = await doCommand(`${binary} help`);
      expect(stdout).toMatch(/generate-action/);
      expect(stdout).toMatch(/Usage: actionhero \[options\] \[command\]/);
      expect(stdout).toMatch(/generate-server/);
      expect(stdout).toMatch(/generate-server \[options\]/);
    }, 20000);

    test("can call the version command (after generate)", async () => {
      const { stdout } = await doCommand(`${binary} --version`);
      expect(stdout).toContain("0.1.0"); // this project's version
    }, 20000);

    test("will show a warning with bogus input", async () => {
      try {
        await doCommand(`${binary} not-a-thing`);
        throw new Error("should not get here");
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.exitCode).toEqual(1);
        expect(error.stderr).toMatch(/unknown command 'not-a-thing'/);
        expect(error.stderr).toMatch(/See 'actionhero --help/);
      }
    }, 20000);

    describe("generating files", () => {
      afterAll(() => {
        const files = [
          `${testDir}/src/actions/myAction.ts`,
          `${testDir}/__tests__/actions/myAction.ts`,
          `${testDir}/src/tasks/myTask.ts`,
          `${testDir}/__tests__/tasks/myTask.ts`,
          `${testDir}/src/bin/myCommand.ts`,
          `${testDir}/src/servers/myServer.ts`,
          `${testDir}/src/initializers/myInitializer.ts`,
        ];

        files.forEach((f) => {
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        });
      });

      test("can generate an action", async () => {
        await doCommand(
          `${binary} generate-action --name=myAction --description=my_description`
        );
        const actionData = String(
          fs.readFileSync(`${testDir}/src/actions/myAction.ts`)
        );
        expect(actionData).toMatch(/export class MyAction extends Action/);
        expect(actionData).toMatch(/this.name = "myAction"/);

        const testData = String(
          fs.readFileSync(`${testDir}/__tests__/actions/myAction.ts`)
        );
        expect(testData).toMatch('describe("Action: myAction"');
      }, 20000);

      test("can generate a task", async () => {
        await doCommand(
          `${binary} generate-task --name=myTask --description=my_description --queue=my_queue --frequency=12345`
        );
        const taskData = String(
          fs.readFileSync(`${testDir}/src/tasks/myTask.ts`)
        );
        expect(taskData).toMatch(/export class MyTask extends Task/);
        expect(taskData).toMatch(/this.name = "myTask"/);
        expect(taskData).toMatch(/this.queue = "my_queue"/);
        expect(taskData).toMatch(/this.frequency = 12345/);

        const testData = String(
          fs.readFileSync(`${testDir}/__tests__/tasks/myTask.ts`)
        );
        expect(testData).toMatch('describe("Task: myTask"');
      }, 20000);

      test("can generate a CLI command", async () => {
        await doCommand(
          `${binary} generate-cli --name=myCommand --description=my_description --example=my_example`
        );
        const data = String(fs.readFileSync(`${testDir}/src/bin/myCommand.ts`));
        expect(data).toMatch(/this.name = "myCommand"/);
        expect(data).toMatch(/this.example = "my_example"/);
      }, 20000);

      test("can generate a server", async () => {
        await doCommand(`${binary} generate-server --name=myServer`);
        const data = String(
          fs.readFileSync(`${testDir}/src/servers/myServer.ts`)
        );
        expect(data).toMatch(/this.type = "myServer"/);
        expect(data).toMatch(/canChat: false/);
        expect(data).toMatch(/logConnections: true/);
        expect(data).toMatch(/logExits: true/);
        expect(data).toMatch(/sendWelcomeMessage: false/);
      }, 20000);

      test("can generate an initializer", async () => {
        await doCommand(
          `${binary} generate-initializer --name=myInitializer --stopPriority=123`
        );
        const data = String(
          fs.readFileSync(`${testDir}/src/initializers/myInitializer.ts`)
        );
        expect(data).toMatch(/this.loadPriority = 1000/);
        expect(data).toMatch(/this.startPriority = 1000/);
        expect(data).toMatch(/this.stopPriority = 123/);
        expect(data).toMatch(/async initialize\(\) {/);
        expect(data).toMatch(/async start\(\) {/);
        expect(data).toMatch(/async stop\(\) {/);
      }, 20000);
    });

    test("can call npm test in the new project and not fail", async () => {
      // since prettier no longer works with node < 10, we need to skip this test
      const nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
      if (nodeVersion < 10) {
        console.log(
          `skpping 'npm test' because this node version ${nodeVersion} < 10.0.0`
        );
        return;
      }

      // jest writes to stderr for some reason, so we need to test for the exit code here
      try {
        await doCommand("npm test", true, { NODE_ENV: "test" });
      } catch (error) {
        if (error.exitCode !== 0) {
          throw error;
        }
      }
    }, 120000);

    describe("can run the server", () => {
      let serverPid;

      beforeAll(async function () {
        doCommand(`node dist/server.js`, true, { PORT: port });
        await sleep(5000);
        serverPid = pid;
      }, 20000);

      afterAll(async () => {
        if (isrunning(serverPid)) {
          await doCommand(`kill ${serverPid}`);
        }
      });

      test("can boot the server", async () => {
        const response = await request(`http://${host}:${port}/api/status`, {
          json: true,
        });
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      });

      test("can handle signals to reboot", async () => {
        await doCommand(`kill -s USR2 ${serverPid}`);
        await sleep(3000);
        const response = await request(`http://${host}:${port}/api/status`, {
          json: true,
        });
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      }, 5000);

      test("can handle signals to stop", async () => {
        await doCommand(`kill ${serverPid}`);
        await sleep(1000);
        try {
          await request(`http://${host}:${port}/api/status`);
          throw new Error("should not get here");
        } catch (error) {
          expect(error.toString()).toMatch(
            /ECONNREFUSED|ECONNRESET|RequestError/
          );
        }
      });

      // test('will shutdown after the alloted time')
    });
  }
});
