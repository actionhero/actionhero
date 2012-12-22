describe('Core: Tasks', function(){
  var specHelper = require('../helpers/_specHelper.js').specHelper;
  var apiObj = {};
  var rawAPI = {};
  var should = require("should");

  before(function(done){
    specHelper.prepare(0, function(api){ 
      rawAPI = api;
      apiObj = specHelper.cleanAPIObject(api);
      done();
    })
  });

  after(function(done){
    specHelper.stopServer(0, function(api){ 
      done();
    })
  });

  it('all perioduc tasks should be enqueued when the server starts', function(done){
    done();
  });

  it('I can inspect the state of my current tasks, the local queue, and the global queue', function(done){
    done();
  });

  it('re-enquing a periodc task should fail (if it exists locally)', function(done){
    done();
  });

  it('re-enquing a periodc task should fail (if it exists on another server)', function(done){
    done();
  });

  it('re-enquing a periodc task that it being worked on should fail', function(done){
    done();
  });

  it('I can add many non-periodic task instances', function(done){
    done();
  });

  it('If I crash while working on a task, I will clear the crash on my next boot', function(done){
    done();
  });

  it('I cannot work on a task while one is being enqueued (I will retry shortly afterwords)', function(done){
    done();
  });

  it('periodc tasks which return a failure will still be re-enqueued and tried again', function(done){
    done();
  });

  it('enquing an "all" task will end up preformed by every server', function(done){
    done();
  });

  it('I will periodically attempt to re-load any missing periodic tasks in the system', function(done){
    done();
  });

  it('I can have more than 1 task worker/timer', function(done){
    done();
  });

  it('I will not process tasks with a runAt in the future', function(done){
    done();
  });

});