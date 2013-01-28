var utils = function(api, next){

  api.utils = {};

  ////////////////////////////////////////////////////////////////////////////
  // sqlDateTime
  api.utils.sqlDateTime = function(time){
    if(time == null){ time = new Date(); }
    var dateStr = 
      api.utils.padDateDoubleStr(time.getFullYear()) +
      "-" + api.utils.padDateDoubleStr(1 + time.getMonth()) +
      "-" + api.utils.padDateDoubleStr(time.getDate()) +
      " " + api.utils.padDateDoubleStr(time.getHours()) +
      ":" + api.utils.padDateDoubleStr(time.getMinutes()) +
      ":" + api.utils.padDateDoubleStr(time.getSeconds());
    return dateStr;
  };

  api.utils.sqlDate = function(time){
    if(time == null){ time = new Date(); }
    var dateStr = 
      api.utils.padDateDoubleStr(time.getFullYear()) +
      "-" + api.utils.padDateDoubleStr(1 + time.getMonth()) +
      "-" + api.utils.padDateDoubleStr(time.getDate());
    return dateStr;
  };

  api.utils.padDateDoubleStr = function(i){
      return (i < 10) ? "0" + i : "" + i;
  };

  ////////////////////////////////////////////////////////////////////////////
  // generate a random string
  api.utils.randomString = function(bits){
    var chars,rand,i,ret
    chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
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
  api.utils.hashLength = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
  };

  ////////////////////////////////////////////////////////////////////////////
  // unique-ify an array
  api.utils.arrayUniqueify = function(arr) {
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
  api.utils.sleepSync = function(naptime){
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
  // randomly sort an array
  api.utils.randomArraySort = function(a,b) {
    return( parseInt( Math.random()*10 ) %2 );
  }

  ////////////////////////////////////////////////////////////////////////////
  // in the array?
  api.utils.inArray = function(haystack, needle) {
    var found = false;
    for(var i in haystack){
      if(haystack[i] === needle){
        found = true;
        break;
      }
    }
    return found;
  }

  ////////////////////////////////////////////////////////////////////////////
  // object Clone
  api.utils.objClone = function(obj){
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce(function(memo, name) {
       return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
    }, {}));
  }

  ////////////////////////////////////////////////////////////////////////////
  // get this server's external internface
  api.utils.getExternalIPAddress = function(){
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
  // cookie parse from headers of http(s) requests
  api.utils.parseCookies = function(req){
    var cookies = {};
    if(req.headers.cookie != null){
      req.headers.cookie.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
      });
    }
    return cookies;
  };

  next()
}
////////////////////////////////////////////////////////////////////////////
// EXPORT
exports.utils = utils;