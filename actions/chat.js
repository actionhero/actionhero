var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "chat";
action.description = "I provide access to chat functions for http(s) clients.  Use method to choose the sub action";
action.inputs = {
  "required" : ["method"],
  "optional" : ["room", "message"]
};
action.blockedConnectionTypes = ['socket', 'webSocket'];
action.outputExample = {
  roomStatus: {
    roomStatus: {
      members: [
        { id:"MTI3LjAuMC4xNjQzNDAwLjUyNDU1NTk1MTgyMjU0OTE="},
        { id:"MTI3LjAuMDAwLjasdasgagUyNDU1NTk1MTgyMjU0OTE="}
      ],
      membersCount: 2
    }
  }
}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  if(connection.type == "web" && api.configData.commonWeb.httpClientMessageTTL != null){
    if (connection.params.method == "roomView"){
      api.chatRoom.socketRoomStatus(connection.room, function(err, roomStatus){
        connection.response.roomStatus = roomStatus;
        next(connection, true);
      });
    }else if(connection.params.method == "roomChange"){
      api.webServer.changeChatRoom(connection, function(){
        next(connection, true);
      })
    }else if(connection.params.method == "detailsView"){
      connection.response.details = {};
      connection.response.details.id = connection.id;
      connection.response.details.room = connection.room;
      next(connection, true);
    }else if(connection.params.method == "say"){
      if(connection.params.message != null){
        api.chatRoom.socketRoomBroadcast(connection, connection.params.message);
      }else{
        connection.error = new Error("message is required to use the say method");
      }
      next(connection, true);
    }else if(connection.params.method == "messages"){
      api.webServer.getWebChatMessage(connection, function(err, messages){
        connection.response.messages = messages;
        next(connection, true);
      });
    }else{
      connection.error = new Error(connection.params.method + " is not a known chat method");
      next(connection, true);
    }
  }else if(connection.type == "web" && api.configData.commonWeb.httpClientMessageTTL == null){
    connection.error = new Error("chatting via web clients is not enabled");
    next(connection, true);
  }
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
