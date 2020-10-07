import { Action, Connection } from "../index";

export class SendFile extends Action {
  constructor() {
    super();
    this.name = "sendFile";
    this.description = "I send a file though an action";
    this.outputExample = {};
  }

  async run(data: { connection: Connection; toRender: boolean }) {
    await data.connection.sendFile("logo/actionhero.png");
    data.toRender = false;
  }
}
