'use strict';

const fs = require('fs');
const path = require('path');
const async = require('async');

module.exports = {
  loadPriority:  0,
  initialize: function(api, next){

    if(!api.utils){ api.utils = {}; }

    ////////////////////////////////////////////////////////////////////////////
    // merge two hashes recursively
    api.utils.hashMerge = function(a, b, arg){
      let c = {};
      let i;
      let response;

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
      const safeTypes     = [Boolean, Number, String, Function, Array, Date, RegExp, Buffer];
      const safeInstances = ['boolean', 'number', 'string', 'function'];
      const expandPreventMatchKey = '_toExpand'; // set `_toExpand = false` within an object if you don't want to expand it
      let i;

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
      let a = [];
      for(let i = 0; i < arr.length; i++){
        for(let j = i + 1; j < arr.length; j++){
          if(arr[i] === arr[j]){ j = ++i; }
        }
        a.push(arr[i]);
      }
      return a;
    };

    ////////////////////////////////////////////////////////////////////////////
    // get all .js files in a directory
    api.utils.recursiveDirectoryGlob = function(dir, extension, followLinkFiles){
      let results = [];

      if(!extension){ extension = '.js'; }
      if(!followLinkFiles){ followLinkFiles = true; }

      extension = extension.replace('.', '');

      if(fs.existsSync(dir)){
        fs.readdirSync(dir).forEach((file) => {
          let fullFilePath = path.join(dir, file);
          if(file[0] !== '.'){ // ignore 'system' files
            let stats = fs.statSync(fullFilePath);
            let child;
            if(stats.isDirectory()){
              child = api.utils.recursiveDirectoryGlob(fullFilePath, extension, followLinkFiles);
              child.forEach((c) => { results.push(c); });
            }else if(stats.isSymbolicLink()){
              let realPath = fs.readlinkSync(fullFilePath);
              child = api.utils.recursiveDirectoryGlob(realPath, extension, followLinkFiles);
              child.forEach((c) => { results.push(c); });
            }else if(stats.isFile()){
              let fileParts = file.split('.');
              let ext = fileParts[(fileParts.length - 1)];
              // real file match
              if(ext === extension){ results.push(fullFilePath); }
              // linkfile traversal
              if(ext === 'link' && followLinkFiles === true){
                let linkedPath = api.utils.sourceRelativeLinkPath(fullFilePath, api.config.general.paths.plugin);
                if(linkedPath){
                  child = api.utils.recursiveDirectoryGlob(linkedPath, extension, followLinkFiles);
                  child.forEach((c) => { results.push(c); });
                }else{
                  try{
                    api.log(['cannot find linked refrence to `%s`', file], 'warning');
                  }catch(e){
                    throw('cannot find linked refrence to ' + file);
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
      const type = fs.readFileSync(linkfile).toString();
      const pathParts = linkfile.split(path.sep);
      const name = pathParts[(pathParts.length - 1)].split('.')[0];
      const pathsToTry = pluginPaths.slice(0);
      let pluginRoot;

      // TODO: always also try the local destination's `node_modules` to allow for nested plugins
      // This might be a security risk without requiring explicit sourcing

      pathsToTry.forEach((pluginPath) => {
        let pluginPathAttempt = path.normalize(pluginPath + path.sep + name);
        try{
          let stats = fs.lstatSync(pluginPathAttempt);
          if(!pluginRoot && (stats.isDirectory() || stats.isSymbolicLink())){ pluginRoot = pluginPathAttempt; }
        }catch(e){ }
      });

      if(!pluginRoot){ return false; }
      let pluginSection = path.normalize(pluginRoot + path.sep + type);
      return pluginSection;
    };

    ////////////////////////////////////////////////////////////////////////////
    // object Clone
    api.utils.objClone = function(obj){
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce((memo, name) => {
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
      }, {}));
    };

    ////////////////////////////////////////////////////////////////////////////
    // attempt to collapse this object to an array; ie: {"0": "a", "1": "b"}
    api.utils.collapseObjectToArray = function(obj){
      try{
        const keys = Object.keys(obj);
        if(keys.length < 1){ return false; }
        if(keys[0] !== '0'){ return false; }
        if(keys[(keys.length - 1)] !== String(keys.length - 1)){ return false; }

        let arr = [];
        for(let i in keys){
          let key = keys[i];
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
      const os = require('os');
      const ifaces = os.networkInterfaces();
      let ip = false;
      for(let dev in ifaces){
        ifaces[dev].forEach((details) => {
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
      let cookies = {};
      if(req.headers.cookie){
        req.headers.cookie.split(';').forEach((cookie) => {
          let parts = cookie.split('=');
          cookies[parts[0].trim()] = (parts[1] || '').trim();
        });
      }
      return cookies;
    };

    ////////////////////////////////////////////////////////////////////////////
    // parse an IPv6 address
    // https://github.com/evantahler/actionhero/issues/275 && https://github.com/nullivex
    api.utils.parseIPv6URI = function(addr){
      let host = '::1';
      let port = '80';
      let regexp = new RegExp(/\[([0-9a-f:]+)\]:([0-9]{1,5})/);
      //if we have brackets parse them and find a port
      if(addr.indexOf('[') > -1 && addr.indexOf(']') > -1){
        let res = regexp.exec(addr);
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
      let intervalJobs = [];
      let intervalTimes = [];

      if(!itterations){ return callback(new Error('itterations is required')); }

      let i = 0;
      while(i < itterations){
        intervalJobs.push((intervalDone) => {
          let start = process.hrtime();
          process.nextTick(() => {
            let delta = process.hrtime(start);
            let ms = (delta[0] * 1000) + (delta[1] / 1000000);
            intervalTimes.push(ms);
            intervalDone();
          });
        });
        i++;
      }

      async.series(intervalJobs, function(){
        let sum = 0;
        intervalTimes.forEach((t) => { sum += t; });
        let avg = Math.round(sum / intervalTimes.length * 10000) / 1000;
        return callback(null, avg);
      });
    };

    ////////////////////////////////////////////////////////////////////////////
    // Sort Global Middleware
    api.utils.sortGlobalMiddleware = function(globalMiddlewareList, middleware){
      globalMiddlewareList.sort((a, b) => {
        if(middleware[a].priority > middleware[b].priority){
          return 1;
        }else{
          return -1;
        }
      });
    };

    ////////////////////////////////////////////////////////////////////////////
    // File utils
    api.utils.dirExists = function(dir){
      try{
        let stats = fs.lstatSync(dir);
        return (stats.isDirectory() || stats.isSymbolicLink());
      }catch(e){ return false; }
    };

    api.utils.fileExists = function(file){
      try{
        let stats = fs.lstatSync(file);
        return (stats.isFile() || stats.isSymbolicLink());
      }catch(e){ return false; }
    },

    api.utils.createDirSafely = function(dir){
      if(api.utils.dirExists(dir)){
        api.log([' - directory \'%s\' already exists, skipping', path.normalize(dir)], 'alert');
      }else{
        api.log([' - creating directory \'%s\'', path.normalize(dir)]);
        fs.mkdirSync(path.normalize(dir), '0766');
      }
    };

    api.utils.createFileSafely = function(file, data, overwrite){
      if(api.utils.fileExists(file) && !overwrite){
        api.log([' - file \'%s\' already exists, skipping', path.normalize(file)], 'alert');
      }else{
        if(overwrite && api.utils.fileExists(file)){
          api.log([' - overwritten file \'%s\'', path.normalize(file)]);
        }else{
          api.log([' - wrote file \'%s\'', path.normalize(file)]);
        }
        fs.writeFileSync(path.normalize(file), data);
      }
    };

    api.utils.createLinkfileSafely = function(filePath, type, refrence){
      if(api.utils.fileExists(filePath)){
        api.log([' - link file \'%s\' already exists, skipping', filePath], 'alert');
      }else{
        api.log([' - creating linkfile \'%s\'', filePath]);
        fs.writeFileSync(filePath, type);
      }
    };

    api.utils.removeLinkfileSafely = function(filePath, type, refrence){
      if(!api.utils.fileExists(filePath)){
        api.log([' - link file \'%s\' doesn\'t exist, skipping', filePath], 'alert');
      }else{
        api.log([' - removing linkfile \'%s\'', filePath]);
        fs.unlinkSync(filePath);
      }
    };

    api.utils.createSymlinkSafely = function(destination, source){
      if(api.utils.dirExists(destination)){
        api.log([' - symbolic link \'%s\' already exists, skipping', destination], 'alert');
      }else{
        api.log([' - creating symbolic link \'%s\' => \'%s\'', destination, source]);
        fs.symlinkSync(source, destination, 'dir');
      }
    };

    next();
  }
};
