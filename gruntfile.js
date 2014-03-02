var grunt = require('grunt')
  , fs = require('fs')
  , path = require('path')
  , debug_port = 5857

grunt.initConfig({
  jshint: {
    options: {
      jshintrc: '.jshintrc',
      reporter: require('jshint-stylish')
    },
    test: {
      src: ['*.js','**/*.js']
    }
  },
  clean: {
    publish: {
      src: 'public/javascript/actionheroWebSocket.min.js'
    }
  },
  projectUpdate: {
    update: {}
  },
  uglify: {
    options: {
      lint: true
    },
    publish: {
      src: 'public/javascript/actionheroClient.js',
      dest: 'public/javascript/actionheroClient.min.js'
    }
  },
  'node-inspector': {
      custom: {
        options: {
          'web-port': 1337,
          'web-host': '',
          'debug-port': debug_port,
          'save-live-edit': true,
          'stack-trace-limit':4
        }
      }
    },
    'run_tasks': {
      aH:[
        {
          path:".",
          cmd:"node --debug="+debug_port+" ./bin/actionhero start"
        }
      ]
    },
    'concurrent': {
      dev: {
        tasks: [ 'run_tasks:aH', 'node-inspector'],
        options: {
          logConcurrentOutput: true
        }
      }
    }
})

grunt.loadTasks(__dirname + '/grunt')

grunt.loadNpmTasks('grunt-contrib-clean')
grunt.loadNpmTasks('grunt-contrib-jshint')
grunt.loadNpmTasks('grunt-contrib-uglify')
grunt.loadNpmTasks('grunt-project-update')
grunt.loadNpmTasks('grunt-node-inspector');
grunt.loadNpmTasks('grunt-concurrent');
grunt.registerTask('publish',['clean:publish','uglify:publish'])
grunt.registerTask('update',['projectUpdate'])
grunt.registerMultiTask('run_tasks', 'Do arbitrary stuff out in the real world.', function(){
    var that = this;
    var fs = require('fs');  
    require('shelljs/global');
    
    that.data.forEach(function(command){
  
      cd(command.path);
        
      exec(command.cmd);
      
      cd(__dirname);
    });
  });