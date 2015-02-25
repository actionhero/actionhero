// These tests will only run on *nix operating systems

var should  = require('should');
var fs      = require('fs');
var path    = require('path');
var exec    = require('child_process').exec;
var testDir = '/tmp/acationheroTestProject';
var binary  = path.normalize(__dirname + '/../../bin/actionhero' );

var doBash = function(commands, callback){
  var fullCommand = '/bin/bash -c \'' + commands.join(' && ') + '\'';
  exec(fullCommand ,function(error, data){
    callback(error, data);
  });
}

describe('Core: Binary', function(){

  before(function(done){
    var sourcePackage = path.normalize(__dirname + '/../../bin/templates/package.json' );
    var commands = [
      'rm -rf ' + testDir,
      'mkdir ' + testDir,
      'cp ' + sourcePackage + ' ' + testDir + '/package.json'
    ];
    doBash(commands, function(){
      var AHPath = path.normalize(__dirname + '/../..');
      fs.readFile(testDir + '/package.json', 'utf8', function(err, data) {
        var result = data.replace(/%%versionNumber%%/g, 'file:' + AHPath);
        fs.writeFile(testDir + '/package.json', result, 'utf8', function() {
           done();
        });
      });
    });
  });

  afterEach(function(done){
    setTimeout(done, 100) // needed to allow Travis' disks to settle...
  })

  it('should have made the test dir', function(done){
    fs.existsSync(testDir).should.equal(true);
    fs.existsSync(testDir + '/package.json').should.equal(true);
    done();
  });

  it('can generate a new project', function(done){
    doBash([
        'cd ' + testDir, 
        binary + ' generate'
      ], function(err){
      should.not.exist(err);
      
      [
        'actions',
        'actions/showDocumentation.js',
        'actions/status.js',
        'config',
        'config/api.js',
        'config/errors.js',
        'config/logger.js',
        'config/plugins',
        'config/plugins.js',
        'config/redis.js',
        'config/routes.js',
        'config/servers',
        'config/stats.js',
        'config/tasks.js',
        'config/servers/web.js',
        'config/servers/websocket.js',
        'config/servers/socket.js',
        'gruntfile.js',
        'pids',
        'log',
        'public',
        'public/index.html',
        'public/chat.html',
        'public/css/actionhero.css',
        'public/javascript',
        'public/logo/actionhero.png',
        'public/logo/sky.jpg',
        'servers',
        'tasks',
        'test',
        'test/example.js',
      ].forEach(function(f){
        // console.log(f);
        fs.existsSync(testDir + '/' + f).should.equal(true);
      });

      done();
    });
  });

  it('can call the help command', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' help'
    ], function(err, data){
      should.not.exist(err);
      data.should.containEql('actionhero startCluster');
      data.should.containEql('Binary options:');
      data.should.containEql('actionhero generateServer');
      done();
    });
  });

  it('will show a warning with bogus input', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' win'
    ], function(err, data){
      should.exist(err);
      data.should.containEql('\'win\' is not a known action');
      data.should.containEql('run \'actionhero help\' for more information');
      done();
    });
  });

  it('can generate an action', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' generateAction --name=myAction --description=my_description'
    ], function(err){
      should.not.exist(err);
      var data = String( fs.readFileSync(testDir + '/actions/myAction.js') );
      data.should.containEql('name:                   \'myAction\'');
      data.should.containEql('description:            \'my_description\'');
      data.should.containEql('next(connection, true)');
      done();
    });
  });

  it('can generate a task', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' generateTask --name=myTask --description=my_description --queue=my_queue --frequency=12345'
    ], function(err){
      should.not.exist(err);
      var data = String( fs.readFileSync(testDir + '/tasks/myTask.js') );
      data.should.containEql('name:          \'myTask\'');
      data.should.containEql('description:   \'my_description\'');
      data.should.containEql('queue:         \'my_queue\'');
      data.should.containEql('frequency:     12345');
      data.should.containEql('next();');
      done();
    });
  });

  it('can generate a server', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' generateServer --name=myServer'
    ], function(err){
      should.not.exist(err);
      var data = String( fs.readFileSync(testDir + '/servers/myServer.js') );
      data.should.containEql('canChat: true');
      data.should.containEql('logConnections: true');
      data.should.containEql('logExits: true');
      data.should.containEql('sendWelcomeMessage: true');
      done();
    });
  });

  it('can generate a initializer', function(done){
    doBash([
      'cd ' + testDir, 
      binary + ' generateInitializer --name=myInitializer'
    ], function(err){
      should.not.exist(err);
      var data = String( fs.readFileSync(testDir + '/initializers/myInitializer.js') );
      data.should.containEql('loadPriority:  1000');
      data.should.containEql('startPriority: 1000');
      data.should.containEql('stopPriority:  1000');
      data.should.containEql('initialize: function(api, next)');
      data.should.containEql('start: function(api, next)');
      data.should.containEql('stop: function(api, next)');
      done();
    });
  });

  describe('can run a single server', function(){
    it('can boot a single server')
    it('can handle signals to reboot')
    it('can handle signals to stop')
    it('will shutdown after the alloted time')
  });

  describe('can run a cluster', function(){
    it('can handle signals to reboot (graceful)')
    it('can handle signals to reboot (hup)')
    it('can handle signals to stop')
    it('can handle signals to add a worker')
    it('can handle signals to remove a worker')
    it('can detect flapping and exit')
    it('can reboot and abosrb code changes without downtime')
  });

});