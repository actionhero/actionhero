'use strict'

exports.createChatRoom = {
  name: 'createChatRoom',
  description: 'I will create a chatroom with the given name',

  outputExample: {},

  inputs: {
    name: { required: true }
  },

  run: function (api, data, next) {
    api.chatRoom.add(data.params.name, next)
  }

}
