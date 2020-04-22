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

  async run({ params, response }) {
    response.didCreate = await chatRoom.add(params.name);
  }
}
