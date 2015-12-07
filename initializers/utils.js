var fs = require('fs');
var path = require('path');

module.exports = {
  loadPriority:  0,
  initialize: function(api, next){
    
    api.utils = {};

    ////////////////////////////////////////////////////////////////////////////
    // count the number of elements in a hash
    api.utils.hashLength = function(obj) {
      var size = 0, key;
      for(key in obj){
        if(obj.hasOwnProperty(key)){ size++ }
      }
      return size;
    }

    ////////////////////////////////////////////////////////////////////////////
    // merge two hashes recursively 
    api.utils.hashMerge = function(a, b, arg){
      var c = {};
      var i, response;

      for(i in a){
        if(api.utils.isPlainObject(a[i]) && Object.keys(a[i]).length > 0 ){
          c[i] = api.utils.hashMerge(c[i], a[i], arg);
        }else{
          if(typeof a[i] === 'function'){
            response = a[i](arg);
            if( api.utils.isPlainObject(response) ){
              c[i] = api.utils.hashMerge(c[i], response, arg);
            }else{
              c[i] = response;
            }
          }else{
            c[i] = a[i];
          }
        }
      }
      for(i in b){
        if(api.utils.isPlainObject(b[i]) && Object.keys(b[i]).length > 0 ){
          c[i] = api.utils.hashMerge(c[i], b[i], arg);
        }else{
          if(typeof b[i] === 'function'){
            response = b[i](arg);
            if( api.utils.isPlainObject(response) ){
              c[i] = api.utils.hashMerge(c[i], response, arg);
            }else{
              c[i] = response;
            }
          }else{
            c[i] = b[i];
          }
        }
      }
      return c;
    }

    api.utils.isPlainObject = function(o){
      var safeTypes     = [ Boolean, Number, String, Function, Array, Date, RegExp, Buffer ];
      var safeInstances = [ 'boolean', 'number', 'string', 'function' ];
      var expandPreventMatchKey = '_toExpand'; // set `_toExpand = false` within an object if you don't want to expand it
      var i;

      if(!o){ return false }
      if((o instanceof Object) === false){ return false }
      for(i in safeTypes){
        if(o instanceof safeTypes[i]){ return false }
      }
      for(i in safeInstances){
        if(typeof o === safeInstances[i]){ return false }
      }
      if(o[expandPreventMatchKey] === false){ return false }
      return (o.toString() === '[object Object]');
    }

    ////////////////////////////////////////////////////////////////////////////
    // unique-ify an array
    api.utils.arrayUniqueify = function(arr){
      var a = [];
      for(var i=0; i<arr.length; i++) {
        for(var j=i+1; j<arr.length; j++) {
          if (arr[i] === arr[j]){ j = ++i }
        }
        a.push(arr[i]);
      }
      return a;
    }

    ////////////////////////////////////////////////////////////////////////////
    // get all .js files in a directory
    api.utils.recursiveDirectoryGlob = function(dir, extension){
      var results = [];

      if(!extension){ extension = 'js'; }
      extension = extension.replace('.','');
      if(dir[dir.length - 1] !== '/'){ dir += '/' }

      if(fs.existsSync(dir)){
        fs.readdirSync(dir).forEach( function(file) {
          var fullFilePath = path.normalize(dir + file);
          if(file[0] !== '.'){ // ignore 'system' files
            var stats = fs.statSync(fullFilePath);
            var child;
            if(stats.isDirectory()){
              child = api.utils.recursiveDirectoryGlob(fullFilePath, extension);
              child.forEach(function(c){ results.push(c); })
            } else if(stats.isSymbolicLink()){
              var realPath = fs.readlinkSync(fullFilePath);
              child = api.utils.recursiveDirectoryGlob(realPath);
              child.forEach(function(c){ results.push(c); })
            } else if(stats.isFile()){
              var fileParts = file.split('.');
              var ext = fileParts[(fileParts.length - 1)];
              if(ext === extension){ results.push(fullFilePath); }
            }
          }
        });
      }
      
      return results.sort();
    }

    ////////////////////////////////////////////////////////////////////////////
    // object Clone
    api.utils.objClone = function(obj){
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce(function(memo, name) {
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
      }, {}));
    }

    ////////////////////////////////////////////////////////////////////////////
    // attempt to collapse this object to an array; ie: {"0": "a", "1": "b"}
    api.utils.collapseObjectToArray = function(obj){
      try{
        var keys = Object.keys(obj)
        if(keys.length < 1){ return false }
        if(keys[0] !== '0'){ return false }
        if(keys[(keys.length - 1)] !== String(keys.length - 1)){ return false }
        
        var arr = [];
        for(var i in keys){
          var key = keys[i];
          if(String(parseInt(key)) !== key){ return false }
          else{ arr.push(obj[key]); }
        }

        return arr;
      }catch(e){
        return false
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    // get this servers external interface
    api.utils.getExternalIPAddress = function(){
      var os = require('os')
      var ifaces = os.networkInterfaces();
      var ip = false;
      for(var dev in ifaces){
        ifaces[dev].forEach(function(details){
          if(details.family === 'IPv4' && details.address !== '127.0.0.1'){
            ip = details.address;
          }
        });
      }
      return ip;
    }

    ////////////////////////////////////////////////////////////////////////////
    // cookie parse from headers of http(s) requests
    api.utils.parseCookies = function(req){
      var cookies = {};
      if(req.headers.cookie){
        req.headers.cookie.split(';').forEach(function(cookie){
          var parts = cookie.split('=');
          cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
        });
      }
      return cookies;
    }

    ////////////////////////////////////////////////////////////////////////////
    // parse an IPv6 address 
    // https://github.com/evantahler/actionhero/issues/275 && https://github.com/nullivex
    api.utils.parseIPv6URI = function(addr){
      var host = '::1'
        , port = '80'
        , regexp = new RegExp(/\[([0-9a-f:]+)\]:([0-9]{1,5})/)
      //if we have brackets parse them and find a port
      if(-1 < addr.indexOf('[') && -1 < addr.indexOf(']')){
        var res = regexp.exec(addr)
        if(null === res){
          throw new Error('failed to parse address')
        }
        host = res[1]
        port = res[2]
      } else {
        host = addr
      }
      return {host: host, port: parseInt(port,10)}
    }

    next();
  }
}
