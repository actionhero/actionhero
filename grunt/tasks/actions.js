module.exports = function(grunt){

  grunt.registerTask('list', 'List your actions and metadata', function(){
    var done = this.async();
    grunt.startActionhero(function(api){
      
      for(var actionName in api.actions.actions){
        
        grunt.log.writeln(actionName)      
        var collection = api.actions.actions[actionName]
        
        for(var version in collection){
          var action = collection[version];
          grunt.log.writeln('  ' + 'version: ' + version)
          grunt.log.writeln('    ' + action.description)
          grunt.log.writeln('    ' + 'required inputs: ' + action.inputs.required.join(', '))
          grunt.log.writeln('    ' + 'optional inputs: ' + action.inputs.optional.join(', '))
        }
      }
      done();
      
    })
    
  });
  
};