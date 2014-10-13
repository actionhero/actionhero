module.exports = function(grunt){

  grunt.registerTask('flushRedis', 'Clear the entire actionhero redis database', function(){
    var done = this.async();
    grunt.startActionhero(function(api){
          
      api.redis.client.flushdb(function(err){
        if(err) throw err
        grunt.log.writeln('flushed')
        done()
      })
      
    })
    
  });
  
};