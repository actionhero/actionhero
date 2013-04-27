var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "chat";
action.description = "I provide access to chat functions for http(s) clients.  Use method to choose the sub action";
action.inputs = {
  "required" : ["room", "message"],
  "optional" : []
};
action.blockedConnectionTypes = ['socket', 'webSocket'];
action.outputExample = {}

/////////////////////////////////////////////////////////////////////
// functional
action.run = function(api, connection, next){
  if(connection.type == "web"){
    // you probably want to build some auth here
    api.chatRoom.socketRoomBroadcast({room: connection.params.room, id: connection.id}, connection.params.message);
    next(connection, true);
  }else{
    connection.error = new Error("please chat using your transport's native chat methods");
    next(connection, true);
  }
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
