import { chatRoom, Action, ParamsFrom } from "./../index";

export class CreateChatRoom extends Action {
  name = "createChatRoom";
  description = "I will create a chatroom with the given name";
  inputs = {
    name: { required: true as true },
  };

  async run({ params }: { params: ParamsFrom<CreateChatRoom> }) {
    let didCreate = false;

    if (!(await chatRoom.exists(params.name))) {
      await chatRoom.add(params.name);
      didCreate = true;
    }

    return { name: params.name, didCreate };
  }
}
