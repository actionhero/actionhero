var action = {};

/////////////////////////////////////////////////////////////////////
// metadata
action.name = "chat";
action.description = "I provide access to chat functions for http(s) clients.  Use method to choose the sub action";
action.inputs = {
	"required" : ["method"],
	"optional" : ["room", "message"]
};
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
	if(connection.type == "web"){
		if (connection.params.method == "roomView"){
			api.chatRoom.socketRoomStatus(api, connection.room, function(roomStatus){
				connection.response.roomStatus = roomStatus;
				next(connection, true);
			});
		}else if(connection.params.method == "roomChange"){
			api.webServer.changeChatRoom(api, connection, function(){
				next(connection, true);
			})
		}else if(connection.params.method == "detailsView"){
			connection.response.details = {};
			connection.response.details.public = connection.public;
			connection.response.details.room = connection.room;
			next(connection, true);
		}else if(connection.params.method == "say"){
			if(connection.params.message != null){
				api.chatRoom.socketRoomBroadcast(api, connection, connection.params.message);
			}else{
				connection.error = "message is required to use the say method";
			}
			next(connection, true);
		}else if(connection.params.method == "messages"){
			api.webServer.getWebChatMessage(api, connection, function(message){
				connection.response.message = message;
				next(connection, true);
			});
		}else{
			connection.error = connection.params.method + " is not a known chat method";
			next(connection, true);
		}
	}else{
		connection.error = "this action is only for web clients; use your proticol's native methods";
		next(connection, true);
	}
};

/////////////////////////////////////////////////////////////////////
// exports
exports.action = action;
