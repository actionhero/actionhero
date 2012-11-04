describe('Client: Web Sockets', function(){
    var specHelper = require('../helpers/_specHelper.js').specHelper;
    var apiObj = {};
    var should = require("should");
    var io = require('socket.io-client');
    var socketURL = "http://localhost:9000";
	var io_options ={
	  transports: ['websocket'],
	  'force new connection': true
	};
	var client_1 = {};
	var client_2 = {};

	function makeSocketRequest(thisClient, type, data, cb){
	  var listener = function(response){ 
	    thisClient.removeListener('response', listener); 
	    cb(response); 
	  };
	  thisClient.on('response', listener);
	  thisClient.emit(type, data);
	}

	function countWebSocketConnections(){
		var found = 0;
		for(var i in apiObj.connections){
			if(apiObj.connections[i].type == "webSocket"){
				found++;
			}
		}
		return found;
	}

    before(function(done){
        specHelper.prepare(0, function(api){ 
            apiObj = specHelper.cleanAPIObject(api);
            done();
        })
    });

    it('socket client connections should work: client 1', function(done){
    	client_1 = io.connect(socketURL, io_options);
		client_1.on('welcome', function(data){
			data.should.be.an.instanceOf(Object);
			data.context.should.equal("api");
			data.room.should.equal("defaultRoom");
			done();
		});
    });

    it('socket client connections should work: client 2', function(done){
    	client_2 = io.connect(socketURL, io_options);
		client_2.on('welcome', function(data){
			data.should.be.an.instanceOf(Object);
			data.context.should.equal("api");
			data.room.should.equal("defaultRoom");
			done();
		});
    });

    it('Other clients should have been told abou people entering the room', function(done){
    	var listener = function(response){
    		client_1.removeListener('say', listener);
    		response.should.be.an.instanceOf(Object);
    		response.context.should.equal('user');
    		response.message.should.equal('I have entered the room');
    		done();
    	}
    	client_1.on('say', listener);
    });

    it('I can get my connection details', function(done){
    	makeSocketRequest(client_1, "detailsView", {}, function(response){
    		response.should.be.an.instanceOf(Object);
    		response.status.should.equal("OK")
    		response.details.public.connectedAt.should.be.within(0, new Date().getTime())
    		response.details.room.should.equal("defaultRoom")
    		done()
    	});
    });

    it('Clients can talk to each other', function(done){
    	var listener = function(response){
    		client_1.removeListener('say', listener);
    		response.should.be.an.instanceOf(Object);
    		response.context.should.equal('user');
    		response.message.should.equal('hello from client 2');
    		done();
    	}
    	client_1.on('say', listener);
    	client_2.emit("say", {message: "hello from client 2"});
    });

    it('can run actions with errors', function(done){
    	makeSocketRequest(client_1, "action", {action: "cacheTest"}, function(response){
    		response.should.be.an.instanceOf(Object);
    		response.error.should.equal("Error: key is a required parameter for this action");
    		done();
    	});
    });

    it('can run actions', function(done){
    	makeSocketRequest(client_1, "action", {action: "cacheTest", key: "test key", value: "test value"}, function(response){
    		response.should.be.an.instanceOf(Object);
            should.not.exist(response.error);
    		done();
    	});
    });

    it('can change rooms and get room details', function(done){
    	 client_1.emit("roomChange", {room: "otherRoom"});
    	 makeSocketRequest(client_1, "roomView", {}, function(response){
    	 	response.should.be.an.instanceOf(Object);
    	 	should.not.exist(response.error);
    	 	response.room.should.equal("otherRoom")
    	 	done();
    	 });
    });

    it('can disconnect', function(done){
    	countWebSocketConnections().should.equal(2);
    	client_1.disconnect();
		client_2.disconnect();
		setTimeout(function(){
		  countWebSocketConnections().should.equal(0);
		  done();
		}, 500);
    })
});