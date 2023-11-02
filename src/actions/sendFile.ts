import { Action, Connection } from "../index";

export class SendFile extends Action {
  name = "sendFile";
  description = "I send a file though an action";
  outputExample = {};
  inputs = {
    contentType: {
      required: false,
      validator: (param: string) => {
        return typeof param === "string";
      }
    }
  };

  async run(data: { params: { contentType: string }; connection: Connection; toRender: boolean }) {
    if (data.params.contentType) {
      data.connection.rawConnection.responseHeaders.push(['Content-Type', data.params.contentType])
    }
    await data.connection.sendFile("logo/actionhero.png");
    data.toRender = false;
  }
}
