'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');

module.exports = {
  loadPriority:  0,
  initialize: function(api, next){

    if(!api.utils){ api.utils = {}; }

    ////////////////////////////////////////////////////////////////////////////
    // merge two hashes recursively
    api.utils.hashMerge = function(a, b, arg){
      var c = {};
      var i;
      var response;

      for(i in a){
        if(api.utils.isPlainObject(a[i]) && Object.keys(a[i]).length > 0){
          c[i] = api.utils.hashMerge(c[i], a[i], arg);
        }else{
          if(typeof a[i] === 'function'){
            response = a[i](arg);
            if(api.utils.isPlainObject(response)){
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
        if(api.utils.isPlainObject(b[i]) && Object.keys(b[i]).length > 0){
          c[i] = api.utils.hashMerge(c[i], b[i], arg);
        }else{
          if(typeof b[i] === 'function'){
            response = b[i](arg);
            if(api.utils.isPlainObject(response)){
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
    };

    api.utils.isPlainObject = function(o){
      var safeTypes     = [Boolean, Number, String, Function, Array, Date, RegExp, Buffer];
      var safeInstances = ['boolean', 'number', 'string', 'function'];
      var expandPreventMatchKey = '_toExpand'; // set `_toExpand = false` within an object if you don't want to expand it
      var i;

      if(!o){ return false; }
      if((o instanceof Object) === false){ return false; }
      for(i in safeTypes){
        if(o instanceof safeTypes[i]){ return false; }
      }
      for(i in safeInstances){
        if(typeof o === safeInstances[i]){ return false; }
      }
      if(o[expandPreventMatchKey] === false){ return false; }
      return (o.toString() === '[object Object]');
    };

    ////////////////////////////////////////////////////////////////////////////
    // string to hash
    // http://stackoverflow.com/questions/6393943/convert-javascript-string-in-dot-notation-into-an-object-reference
    api.utils.stringToHash = function(path, object){
      if(!object){ object = api; }
      function _index(obj, i){ return obj[i]; }
      return path.split('.').reduce(_index, object);
    };

    ////////////////////////////////////////////////////////////////////////////
    // unique-ify an array
    api.utils.arrayUniqueify = function(arr){
      var a = [];
      for(var i = 0; i < arr.length; i++){
        for(var j = i + 1; j < arr.length; j++){
          if(arr[i] === arr[j]){ j = ++i; }
        }
        a.push(arr[i]);
      }
      return a;
    };

    ////////////////////////////////////////////////////////////////////////////
    // get all .js files in a directory
    api.utils.recursiveDirectoryGlob = function(dir, extension, followLinkFiles){
      var results = [];

      if(!extension){ extension = '.js'; }
      if(!followLinkFiles){ followLinkFiles = true; }

      extension = extension.replace('.', '');

      if(fs.existsSync(dir)){
        fs.readdirSync(dir).forEach(function(file){
          var fullFilePath = path.join(dir, file);
          if(file[0] !== '.'){ // ignore 'system' files
            var stats = fs.statSync(fullFilePath);
            var child;
            if(stats.isDirectory()){
              child = api.utils.recursiveDirectoryGlob(fullFilePath, extension, followLinkFiles);
              child.forEach(function(c){ results.push(c); });
            }else if(stats.isSymbolicLink()){
              var realPath = fs.readlinkSync(fullFilePath);
              child = api.utils.recursiveDirectoryGlob(realPath, extension, followLinkFiles);
              child.forEach(function(c){ results.push(c); });
            }else if(stats.isFile()){
              var fileParts = file.split('.');
              var ext = fileParts[(fileParts.length - 1)];
              // real file match
              if(ext === extension){ results.push(fullFilePath); }
              // linkfile traversal
              if(ext === 'link' && followLinkFiles === true){
                var linkedPath = api.utils.sourceRelativeLinkPath(fullFilePath, api.config.general.paths.plugin);
                if(linkedPath){
                  child = api.utils.recursiveDirectoryGlob(linkedPath, extension, followLinkFiles);
                  child.forEach(function(c){ results.push(c); });
                }else{
                  try{
                    api.log(['cannot find linked refrence to `%s`', file], 'warning');
                  }catch(e){
                    throw('cannot find linked refrence to' + file);
                  }
                }
              }
            }
          }
        });
      }

      return results.sort();
    };

    api.utils.sourceRelativeLinkPath = function(linkfile, pluginPaths){
      var type = fs.readFileSync(linkfile).toString();
      var pathParts = linkfile.split(path.sep);
      var name = pathParts[(pathParts.length - 1)].split('.')[0];
      var pathsToTry = pluginPaths.slice(0);
      var pluginRoot;

      // TODO: always also try the local destination's `node_modules` to allow for nested plugins
      // This might be a security risk without requiring explicit sourcing

      pathsToTry.forEach(function(pluginPath){
        var pluginPathAttempt = path.normalize(pluginPath + path.sep + name);
        try{
          var stats = fs.lstatSync(pluginPathAttempt);
          if(!pluginRoot && (stats.isDirectory() || stats.isSymbolicLink())){ pluginRoot = pluginPathAttempt; }
        }catch(e){ }
      });

      if(!pluginRoot){ return false; }
      var pluginSection = path.normalize(pluginRoot + path.sep + type);
      return pluginSection;
    };

    ////////////////////////////////////////////////////////////////////////////
    // object Clone
    api.utils.objClone = function(obj){
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce(function(memo, name){
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
      }, {}));
    };

    ////////////////////////////////////////////////////////////////////////////
    // attempt to collapse this object to an array; ie: {"0": "a", "1": "b"}
    api.utils.collapseObjectToArray = function(obj){
      try{
        var keys = Object.keys(obj);
        if(keys.length < 1){ return false; }
        if(keys[0] !== '0'){ return false; }
        if(keys[(keys.length - 1)] !== String(keys.length - 1)){ return false; }

        var arr = [];
        for(var i in keys){
          var key = keys[i];
          if(String(parseInt(key)) !== key){ return false; }
          else{ arr.push(obj[key]); }
        }

        return arr;
      }catch(e){
        return false;
      }
    };

    ////////////////////////////////////////////////////////////////////////////
    // get this servers external interface
    api.utils.getExternalIPAddress = function(){
      var os = require('os');
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
    };

    ////////////////////////////////////////////////////////////////////////////
    // cookie parse from headers of http(s) requests
    api.utils.parseCookies = function(req){
      var cookies = {};
      if(req.headers.cookie){
        req.headers.cookie.split(';').forEach(function(cookie){
          var parts = cookie.split('=');
          cookies[parts[0].trim()] = (parts[1] || '').trim();
        });
      }
      return cookies;
    };

    ////////////////////////////////////////////////////////////////////////////
    // parse an IPv6 address
    // https://github.com/evantahler/actionhero/issues/275 && https://github.com/nullivex
    api.utils.parseIPv6URI = function(addr){
      var host = '::1';
      var port = '80';
      var regexp = new RegExp(/\[([0-9a-f:]+)\]:([0-9]{1,5})/);
      //if we have brackets parse them and find a port
      if(addr.indexOf('[') > -1 && addr.indexOf(']') > -1){
        var res = regexp.exec(addr);
        if(res === null){
          throw new Error('failed to parse address');
        }
        host = res[1];
        port = res[2];
      }else{
        host = addr;
      }
      return {host: host, port: parseInt(port, 10)};
    };

    ////////////////////////////////////////////////////////////////////////////
    // Check on how long the event loop is blocked for
    api.utils.eventLoopDelay = function(itterations, callback){
      var intervalJobs = [];
      var intervalTimes = [];

      if(!itterations){ return callback(new Error('itterations is required')); }

      var i = 0;
      while(i < itterations){
        intervalJobs.push(function(intervalDone){
          var start = process.hrtime();
          process.nextTick(function(){
            var delta = process.hrtime(start);
            var ms = (delta[0] * 1000) + (delta[1] / 1000000);
            intervalTimes.push(ms);
            intervalDone();
          });
        });
        i++;
      }

      async.series(intervalJobs, function(){
        var sum = 0;
        intervalTimes.forEach(function(t){ sum += t; });
        var avg = Math.round(sum / intervalTimes.length * 10000) / 1000;
        return callback(null, avg);
      });
    };

    next();
  }
};
