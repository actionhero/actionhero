import * as ChildProcess from "child_process";
import * as path from "path";

async function exec(
  command: string,
  args: Record<string, any>
): Promise<{
  error?: NodeJS.ErrnoException;
  stdout?: string;
}> {
  return new Promise((resolve, reject) => {
    ChildProcess.exec(command, args, (error, stdout, stderr) => {
      if (error) return reject(error);
      if (stderr) return reject(stderr);
      return resolve({ stdout: stdout.toString() });
    });
  });
}

describe("cli commands", () => {
  const env = {
    ...process.env,
    ACTIONHERO_CONFIG_OVERRIDES: JSON.stringify({
      general: {
        paths: {
          cli: [path.join(__dirname, "..", "testCliCommands")],
        },
      },
    }),
  };

  test(
    "new commands appear in help",
    async () => {
      const { stdout } = await exec(
        "./node_modules/.bin/ts-node ./src/bin/actionhero.ts help",
        { env }
      );
      expect(stdout).toContain("hello");
    },
    30 * 1000
  );

  test(
    "can run",
    async () => {
      const { stdout } = await exec(
        "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello",
        { env }
      );
      expect(stdout).toContain("Hello, Dr. World");
    },
    30 * 1000
  );

  test(
    "can format inputs",
    async () => {
      const { stdout } = await exec(
        "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello -t Mr --name Worldwide ",
        { env }
      );
      expect(stdout).toContain("Hello, Mr. Worldwide");
    },
    30 * 1000
  );

  test(
    "can require a value when optional inputs are specified",
    async () => {
      await expect(
        exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello --name",
          {
            env,
          }
        )
      ).rejects.toThrow(/error: option '--name <name>' argument missing/);
    },
    30 * 1000
  );

  test(
    "can validate inputs",
    async () => {
      await expect(
        exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello -t Esq. --name Worldwide ",
          { env }
        )
      ).rejects.toThrow(
        /error: option '-t, --title <title>' argument 'Esq.' is invalid. too many periods/
      );
    },
    30 * 1000
  );

  test(
    "can format variadic inputs individually",
    async () => {
      const { stdout } = await exec(
        "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello --title Mr --name Worldwide --countries France Italy Germany USA",
        { env }
      );
      expect(stdout).toContain(
        "Hello, Mr. Worldwide (France! Italy! Germany! USA!)"
      );
    },
    30 * 1000
  );

  test(
    "can validate variadic inputs individually",
    async () => {
      await expect(
        exec(
          "./node_modules/.bin/ts-node ./src/bin/actionhero.ts hello --title Mr --name Worldwide --countries France italy",
          { env }
        )
      ).rejects.toThrow(
        /error: option '--countries \[countries...\]' argument 'italy' is invalid. country not capitalized/
      );
    },
    30 * 1000
  );
});
