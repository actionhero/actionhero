import { api, CLI } from "./../../../index";

export class ActionsList extends CLI {
  constructor() {
    super();
    this.name = "actions list";
    this.description = "List the actions defined on this server";
  }

  async run() {
    for (const actionName in api.actions.actions) {
      console.log(`\r\n--- ${actionName} ---`);
      const collection = api.actions.actions[actionName];

      for (const version in collection) {
        const action = collection[version];
        console.info(`  version: ${version}`);
        console.info(`    ${action.description}`);
        console.info("    inputs:");
        for (const input in action.inputs) {
          console.info(
            `      ${input}: ${JSON.stringify(action.inputs[input])}`
          );
        }
      }
    }

    return true;
  }
}
