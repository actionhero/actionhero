describe('Core: Tasks', function(){
  var specHelper = require(__dirname + '/_specHelper.js').specHelper;
  var apiObj = {};
  var rawAPI = {};
  var should = require("should");
  var taskOutput = [];
  var queue = 'test';

  before(function(done){
    this.timeout(10000)
    specHelper.stopServer(0, function(api){ 
      specHelper.prepare(0, function(api){ 
        rawAPI = api;
        apiObj = specHelper.cleanAPIObject(api);

        rawAPI.tasks.tasks['regular_task'] = {
          name: 'regular_any',
          description: 'task: ' + this.name,
          queue: 'queue',
          frequency: 0,
          plugins: [],
          pluginOptions: {},
          run: function(api, params, next){
            taskOutput.push(params.word);
            next();
          }
        }

        rawAPI.tasks.tasks['periodic_task'] = {
          name: 'periodic_any',
          description: 'task: ' + this.name,
          queue: 'queue',
          frequency: 1000,
          plugins: [],
          pluginOptions: {},
          run: function(api, params, next){
            taskOutput.push(params.word);
            next();
          }
        }

        done();
      });
    });
  });

  after(function(done){
    specHelper.stopServer(0, function(api){ 
      delete rawAPI.tasks.tasks['regular_task'];
      delete rawAPI.tasks.tasks['periodic_task'];
      done();
    })
  });

  it('setup worked', function(done){
    rawAPI.utils.hashLength(rawAPI.tasks.tasks).should.equal(2 + 1);
    done();
  });

  it('a bad task definition causes an exception');
  it('all queues should start empty');
  it('all perioduc tasks should be enqueued when the server starts');
  it('re-enquing a periodc task should fail');
  it('can inspect queue length');
  it('can inspect delayed queue length');
  it('I can add many jobs');
  it('params are passed to tasks properly');
  it('I can remove and stop a periodic task');
  it('will clear crashed wokrers when booting');

  describe('full worker flow', function(){
    it('normal tasks work');
    it('delayed tasks work');
    it('recurrent tasks work');
  });

});