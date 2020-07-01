#!/usr/bin/env node

// load any custom code, configure the env, as needed

async function main() {
  // create a new actionhero process
  const { Process } = await import("actionhero");
  const app = new Process();

  // handle unix signals and uncaught exceptions & rejections
  app.registerProcessSignals((exitCode) => {
    process.exit(exitCode);
  });

  // start the app!
  // you can pass custom configuration to the process as needed
  await app.start();
}

main();
