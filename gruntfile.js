var grunt = require('grunt')

grunt.initConfig({
  jshint: {
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
    fakeredis: {
      NODE_ENV: 'test',
      fakeredis: 'true'
    },
    realredis: {
      NODE_ENV: 'test',
      fakeredis: 'false'
    }
  },
  mochaTest: {
    options: {
      reporter: 'spec'
    },
    fakeredis: {
      src: 'test/*.js'
    },
    realredis: {
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

grunt.registerTask('testFakeRedis',['env:fakeredis','mochaTest:fakeredis'])
grunt.registerTask('testRealRedis',['env:realredis','mochaTest:realredis'])
grunt.registerTask('test',['jshint','testFakeRedis'])

grunt.registerTask('publish',['jshint','clean:publish','uglify:publish'])
grunt.registerTask('update',['projectUpdate'])