var grunt = require('grunt')
  , fs = require('fs')
  , path = require('path')

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
  }

})

grunt.loadTasks(__dirname + '/grunt')

grunt.loadNpmTasks('grunt-contrib-clean')
grunt.loadNpmTasks('grunt-contrib-jshint')
grunt.loadNpmTasks('grunt-contrib-uglify')
grunt.loadNpmTasks('grunt-project-update')

grunt.registerTask('publish',['clean:publish','uglify:publish'])
grunt.registerTask('update',['projectUpdate'])