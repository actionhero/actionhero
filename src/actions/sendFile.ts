import { Action, Connection } from "../index";
import * as Mime from "mime";

export class SendFile extends Action {
  name = "sendFile";
  description = "I send a file though an action";
  outputExample = {};
  inputs = {
    mimeType: {
      required: false,
      validator: (param: string) => {
        return typeof param === "string" && Mime.getExtension(param) !== null;
      },
    },
  };

  async run(data: {
    params: { mimeType: string };
    connection: Connection;
    toRender: boolean;
  }) {
    if (data.params.mimeType) {
      await data.connection.sendFile("logo/actionhero.png", {
        mimeType: data.params.mimeType,
      });
    } else {
      await data.connection.sendFile("logo/actionhero.png");
    }
    data.toRender = false;
  }
}
