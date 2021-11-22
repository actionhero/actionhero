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
    let didCreate = false;

    if (!(await chatRoom.exists(params.name))) {
      await chatRoom.add(params.name);
      didCreate = true;
    }

    return { name: params.name, didCreate };
  }
}
