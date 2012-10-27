var utils = {};

////////////////////////////////////////////////////////////////////////////
// sqlDateTime
utils.sqlDateTime = function(time){
	if(time == null){ time = new Date(); }
	var dateStr = 
		this.padDateDoubleStr(time.getFullYear()) +
		"-" + this.padDateDoubleStr(1 + time.getMonth()) +
		"-" + this.padDateDoubleStr(time.getDate()) +
		" " + this.padDateDoubleStr(time.getHours()) +
		":" + this.padDateDoubleStr(time.getMinutes()) +
		":" + this.padDateDoubleStr(time.getSeconds());
	return dateStr;
};

utils.padDateDoubleStr = function(i){
    return (i < 10) ? "0" + i : "" + i;
};

////////////////////////////////////////////////////////////////////////////
// generate a random string
utils.randomString = function(bits){
	var chars,rand,i,ret
	chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!'
	ret=''
  	while(bits > 0)
	{
	   rand=Math.floor(Math.random()*0x100000000) // 32-bit integer
	   for(i=26; i>0 && bits>0; i-=6, bits-=6) ret+=chars[0x3F & rand >>> i]
	}
	return ret
}

////////////////////////////////////////////////////////////////////////////
// count the number of elements in a hash
utils.hashLength = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

////////////////////////////////////////////////////////////////////////////
// unique-ify an array
utils.arrayUniqueify = function(arr) {
    var a = [];
    for(var i=0; i<arr.length; i++) {
      for(var j=i+1; j<arr.length; j++) {
        if (arr[i] === arr[j])
          j = ++i;
      }
      a.push(arr[i]);
    }
    return a;
};

////////////////////////////////////////////////////////////////////////////
// blocking sleep
utils.sleepSync = function(naptime){
	naptime = naptime * 1000;
	var sleeping = true;
	var now = new Date();
	var alarm;
	var startingMSeconds = now.getTime();
	while(sleeping){
	    alarm = new Date();
	    var alarmMSeconds = alarm.getTime();
	    if(alarmMSeconds - startingMSeconds > naptime){ sleeping = false; }
	}        
}

////////////////////////////////////////////////////////////////////////////
// sort an array of hashes by a key
utils.sort_by = function(field, reverse, primer){
   reverse = (reverse) ? -1 : 1;
   return function(a,b){
       a = a[field];
       b = b[field];
       if (typeof(primer) != 'undefined'){
           a = primer(a);
           b = primer(b);
       }
       if (a<b) return reverse * -1;
       if (a>b) return reverse * 1;
       return 0;
   }
}

////////////////////////////////////////////////////////////////////////////
// randomly sort an array
utils.randomArraySort = function(a,b) {
    return( parseInt( Math.random()*10 ) %2 );
}

////////////////////////////////////////////////////////////////////////////
// shellExec
utils.shellExec = function(api, command, next){
	var response = {};
	child = api.exec(command, function (error, stdout, stderr) {
		if (stdout.length > 0){ response.stdout = stdout.replace(/(\r\n|\n|\r)/gm,""); }else{response.stdout = stdout; }
		if (stderr.length > 0){ response.stderr = stderr.replace(/(\r\n|\n|\r)/gm,""); }else{response.stderr = stderr; }
	  	if (error !== null) {
	  		api.log(JSON.stringify(error), ["red","bold"]);
	  	}
	  	process.nextTick(function() { next(response); });
	})
}

////////////////////////////////////////////////////////////////////////////
// object Clone
utils.objClone = function(obj){
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce(function(memo, name) {
       return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
    }, {}));
}

////////////////////////////////////////////////////////////////////////////
// get this server's external internface
utils.getExternalIPAddress = function(){
	var os = require('os')
	var ifaces = os.networkInterfaces();
	var ip = false;
	for (var dev in ifaces) {
	  var alias = 0;
	  ifaces[dev].forEach(function(details){
	    if (details.family == 'IPv4' && details.address != "127.0.0.1") {
	      ip =  details.address;
	    }
	  });
	}
	return ip;
}

////////////////////////////////////////////////////////////////////////////
// helpers for setting up and destroyign connections
utils.setupConnection = function(api, connection, type, remotePort, remoteIP){
	if(connection == null){ connection = {}; }
	connection.type = type;
	connection.error = false;
	connection.params = {};
	connection.response = {};
	connection.errror = false;
	connection.remotePort = remotePort;
	connection.remoteIP = remoteIP;
	connection.room = api.configData.general.defaultChatRoom;
	connection.messageCount = 0;
	connection.connectedAt = new Date().getTime();
	if(connection.id == null){
		var md5 = api.crypto.createHash('md5');
		var hashBuff = new Buffer(remotePort+ remoteIP + Math.random() + connection.connectedAt).toString('base64');
		md5.update(hashBuff);
		connection.id = md5.digest('hex');
	}
	connection.public = {
		id: connection.id, 
		connectedAt: connection.connectedAt
	};
	api.connections.push(connection);
	api.chatRoom.roomAddMember(api, connection);
	return connection;
}

utils.destroyConnection = function(api, connection){
	for(var i in api.connections){
		if(api.connections[i].public.id == connection.public.id && connection.type == api.connections[i].type){
			api.connections.splice(i,1);
			delete connection;
			break;
		}
	}
}

////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.utils = utils;