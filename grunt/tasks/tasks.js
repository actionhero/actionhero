module.exports = function(grunt) {
  
  grunt.registerTask('enqueueAllPeriodicTasks', 'This will enqueue all periodic tasks (could lead to duplicates)', function(){
    var done = this.async();
    grunt.startActionhero(function(api){
      
      api.resque.startQueue(function(){
        api.tasks.enqueueAllRecurrentJobs(function(loadedTasks){
          grunt.log.writeln('loaded tasks: ' + loadedTasks.join(', '))
          done();
        })
      });
      
    })
  });
  
  
  
  
  grunt.registerTask('enqueuePeriodicTask', 'Enqueue a periodic task (:taskName)',function(taskName){
    var done = this.async();
    grunt.startActionhero(function(api){
      
      if(!api.tasks.tasks[taskName]) throw new Error('Task "' + taskName + '" not found')
      api.resque.startQueue(function(){
        // enqueue to run ASAP
        api.tasks.enqueue(taskName, function(err, toRun){
          if(err) throw err
          if(toRun === true){
            grunt.log.writeln('loaded task: ' + taskName)
          }else{
            grunt.log.writeln(taskName + ' not enqueued')
          }
          done()
        })
      })
      
    })
  })

  grunt.registerTask('stopPeriodicTask','Remove an enqueued periodic task (:taskName)',function(taskName){
    var done = this.async();
    grunt.startActionhero(function(api){
    
      if(!api.tasks.tasks[taskName]) throw new Error('Task not found')
      api.resque.startQueue(function(){
        api.tasks.stopRecurrentJob(taskName, function(error, count){
          grunt.log.writeln('removed ' + count + ' instances of ' + taskName)
          done()
        })
      })
      
    })
  })
  
};