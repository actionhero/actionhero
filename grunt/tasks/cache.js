module.exports = function(grunt){

  grunt.registerTask('clearCache','Clear the actionhero cache',function(){
    var done = this.async();
    grunt.startActionhero(function(api){
          
      api.cache.clear(function(error, count){
        if(error) throw error
        grunt.log.writeln('cleared ' + count + ' items from the cache');
        done()
      })
      
    })
  })
  

  grunt.registerTask('dumpCache','Save the current cache as a JSON object (:file)',function(file){
    var done = this.async();
    grunt.startActionhero(function(api){
      
      if(undefined === file){ file = 'cache.dump' }
      
      api.cache.dumpWrite(file, function(error, count){
        if(error) throw error
        grunt.log.writeln('dumped ' + count + ' items from the cache to ' + file);
        done()
      })
      
    })
  })


  grunt.registerTask('loadCache','Set the cache from a file (overwrites existing cache) (:file)',function(file){
    var done = this.async();
    grunt.startActionhero(function(api){
          
      if(!file){ file = 'cache.dump' }
      
      api.cache.dumpRead(file, function(error, count){
        if(error) throw error
        grunt.log.writeln('cleared the cache and then loaded ' + count + ' items from ' + file);
        done()
      })
      
    })
  })
  
};