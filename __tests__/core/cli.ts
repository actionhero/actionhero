// Note: These tests will only run on *nix operating systems
// You can use SKIP_CLI_TEST_SETUP=true to skip the setup portion of these tests if you are testing this file repeatedly

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn } from "child_process";
import * as request from "request-promise-native";
import * as isrunning from "is-running";

const testDir = os.tmpdir() + path.sep + "actionheroTestProject";
const binary = "./node_modules/.bin/actionhero";
const pacakgeJSON = require(path.join(__dirname, "/../../package.json"));

console.log(`testDir: ${testDir}`);

const port = 18080 + parseInt(process.env.JEST_WORKER_ID || "0");
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
      env: env
    });

    cmd.stdout.on("data", data => {
      stdout += data.toString();
    });
    cmd.stderr.on("data", data => {
      stderr += data.toString();
    });

    pid = cmd.pid;

    cmd.on("close", exitCode => {
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
  return new Promise(resolve => {
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
        await doCommand("npm install");
      } catch (error) {
        // we might get warnings about package.json locks, etc.  we want to ignore them
        if (error.toString().indexOf("npm") < 0) {
          throw error;
        }
        expect(error.exitCode).toEqual(0);
      }
    }, 120000);

    test("can call the version command (before generate)", async () => {
      const { stdout } = await doCommand(`${binary} version`);
      expect(stdout).toContain(pacakgeJSON.version);
    }, 20000);

    test("can generate a new project", async () => {
      const { stdout } = await doCommand(`${binary} generate`);
      expect(stdout).toMatch("<3, the Actionhero Team");

      [
        "src/actions",
        "src/tasks",
        "src/initializers",
        "src/servers",
        "src/bin",
        "src/actions/showDocumentation.ts",
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
        "public/css/cosmo.css",
        "public/javascript",
        "public/logo/actionhero.png",
        "locales/en.json",
        "__tests__",
        "__tests__/actions/status.ts",
        ".gitignore",
        "boot.js"
      ].forEach(f => {
        expect(fs.existsSync(testDir + "/" + f)).toEqual(true);
      });
    }, 20000);

    test("the project can be compiled", async () => {
      const { stdout } = await doCommand(`npm run build`);
      expect(stdout).toMatch("tsc");
    }, 20000);

    test("can call the help command", async () => {
      const { stdout } = await doCommand(`${binary} help`);
      expect(stdout).toMatch(/actionhero start cluster/);
      expect(stdout).toMatch(
        /The reusable, scalable, and quick node.js API server for stateless and stateful applications/
      );
      expect(stdout).toMatch(/actionhero generate server/);
    }, 20000);

    test("can call the version command (after generate)", async () => {
      const { stdout } = await doCommand(`${binary} version`);
      expect(stdout).toContain(pacakgeJSON.version);
    }, 20000);

    test("will show a warning with bogus input", async () => {
      try {
        await doCommand(`${binary} not-a-thing`);
        throw new Error("should not get here");
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.exitCode).toEqual(1);
        expect(error.stderr).toMatch(
          /`not-a-thing` is not a method I can perform/
        );
        expect(error.stderr).toMatch(/run `actionhero help` to learn more/);
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
          `${testDir}/src/initializers/myInitializer.ts`
        ];

        files.forEach(f => {
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        });
      });

      test("can generate an action", async () => {
        await doCommand(
          `${binary} generate action --name=myAction --description=my_description`
        );
        const actionData = String(
          fs.readFileSync(`${testDir}/src/actions/myAction.ts`)
        );
        expect(actionData).toMatch(/export class MyAction extends Action/);
        expect(actionData).toMatch(/this.name = "myAction"/);

        const testData = String(
          fs.readFileSync(`${testDir}/__tests__/actions/myAction.ts`)
        );
        expect(testData).toMatch('describe("myAction"');
      }, 20000);

      test("can generate a task", async () => {
        await doCommand(
          `${binary} generate task --name=myTask --description=my_description --queue=my_queue --frequency=12345`
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
        expect(testData).toMatch('describe("myTask"');
      }, 20000);

      test("can generate a CLI command", async () => {
        await doCommand(
          `${binary} generate cli --name=myCommand --description=my_description --example=my_example`
        );
        const data = String(fs.readFileSync(`${testDir}/src/bin/myCommand.ts`));
        expect(data).toMatch(/this.name = "myCommand"/);
        expect(data).toMatch(/this.example = "my_example"/);
      }, 20000);

      test("can generate a server", async () => {
        await doCommand(`${binary} generate server --name=myServer`);
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
          `${binary} generate initializer --name=myInitializer --stopPriority=123`
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

    test("can ensure no boot.js does not break, will console.log message", async () => {
      const origBootjs = String(fs.readFileSync(`${testDir}/boot.js`));
      await doCommand(`rm ${testDir}/boot.js`, false);

      const { stdout } = await doCommand(`${binary} version`);
      expect(stdout).toContain(pacakgeJSON.version);

      // replace with orig boot.js
      fs.writeFileSync(`${testDir}/boot.js`, origBootjs);
    }, 20000);

    test("can ensure a custom boot.js runs before everything else", async () => {
      const origBootjs = String(fs.readFileSync(`${testDir}/boot.js`));
      fs.writeFileSync(
        `${testDir}/boot.js`,
        `exports.default = async function BOOT() {
          await new Promise((resolve)=> setTimeout(resolve,500))
          console.log('BOOTING')
        }`
      );

      const { stdout } = await doCommand(`${binary} version`);
      expect({ stdout, start: stdout.startsWith("BOOTING") }).toEqual({
        stdout,
        start: true
      });
      expect(stdout).toContain(pacakgeJSON.version);
      // replace with orig boot.js
      fs.writeFileSync(`${testDir}/boot.js`, origBootjs);
    }, 20000);

    test("can call npm test in the new project and not fail", async () => {
      // jest writes to stderr for some reason, so we need to test for the exit code here
      try {
        await doCommand("npm test", true, { NODE_ENV: "test" });
      } catch (error) {
        if (error.exitCode !== 0) {
          throw error;
        }
      }
    }, 120000);

    describe("can run a single server", () => {
      let serverPid;

      beforeAll(async function() {
        doCommand(`${binary} start`, true, { PORT: port });
        await sleep(5000);
        serverPid = pid;
      }, 20000);

      afterAll(async () => {
        if (isrunning(serverPid)) {
          await doCommand(`kill ${serverPid}`);
        }
      });

      test("can boot a single server", async () => {
        const response = await request(
          `http://localhost:${port}/api/showDocumentation`,
          { json: true }
        );
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      });

      test("can handle signals to reboot", async () => {
        await doCommand(`kill -s USR2 ${serverPid}`);
        await sleep(3000);
        const response = await request(
          `http://localhost:${port}/api/showDocumentation`,
          { json: true }
        );
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      }, 5000);

      test("can handle signals to stop", async () => {
        await doCommand(`kill ${serverPid}`);
        await sleep(1000);
        try {
          await request(`http://localhost:${port}/api/showDocumentation`);
          throw new Error("should not get here");
        } catch (error) {
          expect(error.toString()).toMatch(
            /ECONNREFUSED|ECONNRESET|RequestError/
          );
        }
      });

      // test('will shutdown after the alloted time')
    });

    describe("can run a cluster", () => {
      let clusterPid;
      beforeAll(async function() {
        doCommand(`${binary} start cluster --workers=2`, true, { PORT: port });
        await sleep(10000);
        clusterPid = pid;
      }, 30000);

      afterAll(async () => {
        if (isrunning(clusterPid)) {
          await doCommand(`kill ${clusterPid}`);
        }
      });

      test("should be running the cluster with 2 nodes", async () => {
        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start") >= 0 && l.indexOf("cluster") < 0;
        });
        expect(parents.length).toEqual(1);
        expect(children.length).toEqual(2);

        const response = await request(
          `http://localhost:${port}/api/showDocumentation`,
          { json: true }
        );
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      });

      test("can handle signals to add a worker", async () => {
        await doCommand(`kill -s TTIN ${clusterPid}`);
        await sleep(2000);

        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("bin/actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return (
            l.indexOf("bin/actionhero start") >= 0 && l.indexOf("cluster") < 0
          );
        });
        expect(parents.length).toEqual(1);
        expect(children.length).toEqual(3);
      }, 20000);

      test("can handle signals to remove a worker", async () => {
        await doCommand(`kill -s TTOU ${clusterPid}`);
        await sleep(2000);

        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("bin/actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return (
            l.indexOf("bin/actionhero start") >= 0 && l.indexOf("cluster") < 0
          );
        });
        expect(parents.length).toEqual(1);
        expect(children.length).toEqual(2);
      }, 20000);

      test("can handle signals to reboot (graceful)", async () => {
        await doCommand(`kill -s USR2 ${clusterPid}`);
        await sleep(3000);

        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start") >= 0 && l.indexOf("cluster") < 0;
        });
        expect(parents.length).toEqual(1);
        expect(children.length).toEqual(2);

        const response = await request(
          `http://localhost:${port}/api/showDocumentation`,
          { json: true }
        );
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      }, 20000);

      test("can handle signals to reboot (hup)", async () => {
        await doCommand(`kill -s WINCH ${clusterPid}`);
        await sleep(3000);

        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start") >= 0 && l.indexOf("cluster") < 0;
        });
        expect(parents.length).toEqual(1);
        expect(children.length).toEqual(2);

        const response = await request(
          `http://localhost:${port}/api/showDocumentation`,
          { json: true }
        );
        expect(response.serverInformation.serverName).toEqual(
          "my_actionhero_project"
        );
      }, 20000);

      test("can handle signals to stop", async () => {
        await doCommand(`kill ${clusterPid}`);
        await sleep(8000);

        const { stdout } = await doCommand("ps awx");
        const parents = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start cluster") >= 0;
        });
        const children = stdout.split("\n").filter(l => {
          return l.indexOf("actionhero start") >= 0 && l.indexOf("cluster") < 0;
        });
        expect(parents.length).toEqual(0);
        expect(children.length).toEqual(0);
      }, 20000);

      // test('can detect flapping and exit')
      // test('can reboot and abosrb code changes without downtime')
    });
  }
});
