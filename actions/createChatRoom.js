'use strict'

exports.createChatRoom = {
  name: 'createChatRoom',
  description: 'I will create a chatroom with the given name',

  outputExample: {},

  inputs: {
    name: { required: true }
  },

  run: async function (api, data) {
    await api.chatRoom.add(data.params.name)
  }

}
