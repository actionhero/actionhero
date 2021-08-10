import { ActionProcessor } from "../classes/actionProcessor";
import { chatRoom, Action } from "./../index";

export class CreateChatRoom extends Action {
  constructor() {
    super();
    this.name = "createChatRoom";
    this.description = "I will create a chatroom with the given name";
    this.inputs = {
      name: {
        required: true,
      },
    };
  }

  async run({ params }: { params: { name: string } }) {
    return { didCreate: await chatRoom.add(params.name) };
  }
}
