var fs = require('fs');

var common_loader = function(api){
 
  this.loadFile = function(fullFilePath, reload){
      var self = this;
      
      if(reload == null){ reload = false; }
      
      api.watchFileAndAct(fullFilePath, function(){
        var cleanPath = fullFilePath;
        if(process.platform === 'win32'){
          cleanPath = fullFilePath.replace(/\//g, '\\');
        }

        delete require.cache[require.resolve(cleanPath)];
        self.loadFile(fullFilePath, true);
        try{
        api.params.buildPostVariables();
        }catch(e){}
      });
      
      try {
        var collection = require(fullFilePath);
        for(var i in collection){
          var _module = collection[i];
          self.fileHandler(collection[i], reload);

          api.log('file ' + (reload?'(re)':'') + 'loaded: ' + collection[i].name + ', ' + fullFilePath, 'debug');
        
        }
      } catch(err){

        self.exceptionManager(fullFilePath, err, _module);
      }
    };

  this.loadDirectory = function(path){
    var self = this;
    
    fs.readdirSync(path).forEach( function(file) {
      if(path[path.length - 1] != '/'){ path += '/' }
      var fullFilePath = path + file;
      if(file[0] != '.'){
        var stats = fs.statSync(fullFilePath);
        if(stats.isDirectory()){

          self.loadDirectory(fullFilePath);
        } else if(stats.isSymbolicLink()){
          var realPath = fs.readlinkSync(fullFilePath);
          self.loadDirectory(realPath);
        } else if(stats.isFile()){
          var fileParts = file.split('.');
          var ext = fileParts[(fileParts.length - 1)];
          if(ext === 'js'){ self.loadFile(fullFilePath) }
        } else {
          api.log(file + ' is a type of file I cannot read', 'error')
        }
      }
    });
  };
      
  this._validate = function(module, map){
    
    var fail = function(){
      api.log(module.name+" attribute: "+x+" is invalid." + '; exiting.', 'emerg');
      return false;
    }
  
    for(x in map){
      if(typeof map[x] == 'function'){
        if(map[x](module)){
          return fail();
        }
      }else if(typeof module[x] != map[x]){
         return fail();
      }
    };
    return true;
  };
  
  this.initialize = function(path){
    if(!fs.existsSync(path)){
      api.log("Failed to load initializer for: "+this.path+", path invalid.", "warning");
    }else{
      this.loadDirectory(path);
    } 
  };
};

module.exports = common_loader;

