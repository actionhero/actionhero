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

var actionHeroRoot = function(){
  var rv
  if(fs.existsSync(__dirname + '/actionHero.js')){
    // in the actionHero project itself
    rv = __dirname
  } else if(fs.existsSync(__dirname + '/node_modules/actionHero/actionHero.js')){
    // running from a project's node_modules (bin or actionHero)
    rv = __dirname + '/node_modules/actionHero'
  } else {
    // installed globally
    rv = path.normalize(__dirname)
  }
  return rv
}

var init = function(fn){
  var root = actionHeroRoot()
    , ActionHeroPrototype = require(root + '/actionHero.js').actionHeroPrototype
    , actionHero = new ActionHeroPrototype()
    , configChanges = {
      logger: {
        transports: null
      }
    }
  actionHero.initialize({configChanges: configChanges}, function(err, api){
    fn(api)
  })
}

grunt.registerTask('list','List your actions and metadata',function(){
  var done = this.async()
  init(function(api){
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
    done()
  })
})

grunt.registerTask('enqueueAllPeriodicTasks','This will enqueue all periodic tasks (could lead to duplicates)',function(){
  var done = this.async()
  init(function(api){
    api.resque.startQueue(function(){
      api.tasks.enqueueAllRecurrentJobs(function(loadedTasks){
        grunt.log.writeln('loaded tasks: ' + loadedTasks.join(', '))
        done()
      })
    })
  })
})

grunt.registerTask('enqueuePeriodicTask','Enqueue a periodic task',function(taskName){
  var done = this.async()
  init(function(api){
    if(!api.tasks.tasks[taskName]) throw new Error('Task not found')
    api.resque.startQueue(function(){
      // enqueue to run ASAP
      api.tasks.enqueue(taskName, function(err){
        if(err) throw err
        grunt.log.writeln('loaded task: ' + taskName)
        done()
      })
    })
  })
})

grunt.registerTask('stopPeriodicTask','Remove an enqueued periodic task',function(taskName){
  var done = this.async()
  init(function(api){
    if(!api.tasks.tasks[taskName]) throw new Error('Task not found')
    api.resque.startQueue(function(){
      api.tasks.stopRecurrentJob(taskName, function(error, count){
        grunt.log.writeln('removed ' + count + ' instances of ' + taskName)
        done()
      })
    })
  })
})

grunt.registerTask('flushRedis','Clear the entire actionHero redis database',function(){
  var done = this.async()
  init(function(api){
    api.redis.client.flushdb(function(err){
      if(err) throw err
      grunt.log.writeln('flushed')
      done()
    })
  })
})

grunt.registerTask('clearCache','Clear the actionHero cache',function(){
  var done = this.async()
  init(function(api){
    api.cache.size(function(err, count){
      if(err) throw err
      api.redis.client.del(api.cache.redisCacheKey, function(err){
        if(err) throw err
        grunt.log.writeln('cleared ' + count + ' items from the cache')
        done()
      })
    })
  })
})

grunt.registerTask('dumpCache','Save the current cache as a JSON object',function(file){
  var done = this.async()
  init(function(api){
    if(undefined === file) file = 'cache.dump'
    api.cache.size(function(err, count){
      if(err) throw err
      api.redis.client.hgetall(api.cache.redisCacheKey, function(err, data){
        if(err) throw err
        if(!data) data = {}
        fs.writeFileSync(file, JSON.stringify(data))
        grunt.log.writeln('dumped ' + count + ' items from the cache')
        done()
      })
    })
  })
})

grunt.registerTask('setCache','Set the cache from a file (overwrites existing cache)',function(file){
  var done = this.async()
  init(function(api){
    if(undefined === file) file = 'cache.dump'
    var data = JSON.parse(fs.readFileSync(file)) || {}
    api.redis.client.hmset(api.cache.redisCacheKey, data, function(err){
      if(err) throw err
      api.cache.size(function(err, count){
        if(err) throw err
        grunt.log.writeln('loaded ' + count + ' items into the cache')
        done()
      })
    })
  })
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