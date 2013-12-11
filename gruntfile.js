var grunt = require('grunt')

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
      src: 'public/javascript/actionHeroWebSocket.min.js'
    }
  },
  env: {
    test: {
      NODE_ENV: 'test'
    },
    fakeredis: {
      fakeredis: 'true'
    },
    realredis: {
      fakeredis: 'false'
    }
  },
  mochaTest: {
    options: {
      reporter: 'spec'
    },
    test: {
      src: 'test/*.js'
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
      src: 'public/javascript/actionHeroWebSocket.js',
      dest: 'public/javascript/actionHeroWebSocket.min.js'
    }
  }
})

grunt.loadNpmTasks('grunt-contrib-clean')
grunt.loadNpmTasks('grunt-contrib-jshint')
grunt.loadNpmTasks('grunt-contrib-uglify')
grunt.loadNpmTasks('grunt-env')
grunt.loadNpmTasks('grunt-mocha-test')
grunt.loadNpmTasks('grunt-project-update')

grunt.registerTask('testProduction',['env:test','env:realredis','mochaTest'])
grunt.registerTask('test',['env:test','env:fakeredis','mochaTest'])

grunt.registerTask('publish',['clean:publish','uglify:publish'])
grunt.registerTask('update',['projectUpdate'])