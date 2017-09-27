'use strict'
const ActionHero = require('./../index.js')

module.exports = class CreateChatRoom extends ActionHero.Action {
  constructor () {
    super()
    this.name = 'createChatRoom'
    this.description = 'I will create a chatroom with the given name'
    this.inputs = {
      name: {
        required: true
      }
    }
  }

  async run ({params, response}) {
    const {chatRoom} = ActionHero.api
    response.didCreate = await chatRoom.add(params.name)
  }
}
