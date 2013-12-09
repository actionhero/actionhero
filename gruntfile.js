var grunt = require('grunt')

grunt.initConfig({
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
    test: {
      src: 'test/*.js'
    }
  },
  projectUpdate: {
    projectUpdate: {
      options: {
        commands: [
          {cmd: 'npm', args: ['install']},
          {cmd: 'npm', args: ['update']},
          {cmd: 'npm', args: ['prune']}
        ]
      }
    }
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
grunt.loadNpmTasks('grunt-contrib-uglify')
grunt.loadNpmTasks('grunt-env')
grunt.loadNpmTasks('grunt-mocha-test')
grunt.loadNpmTasks('grunt-project-update')

grunt.registerTask('testFakeRedis',['env:fakeredis','mochaTest'])
grunt.registerTask('testRealRedis',['env:realredis','mochaTest'])
grunt.registerTask('test',['testFakeRedis','testRealRedis'])

grunt.registerTask('publish',['clean:publish','uglify:publish'])
grunt.registerTask('update',['projectUpdate'])