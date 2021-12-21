import { Action, Connection } from "../index";

export class SendFile extends Action {
  name = "sendFile";
  description = "I send a file though an action";
  outputExample = {};

  async run(data: { connection: Connection; toRender: boolean }) {
    await data.connection.sendFile("logo/actionhero.png");
    data.toRender = false;
  }
}
