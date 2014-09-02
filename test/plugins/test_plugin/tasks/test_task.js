var task = {
  name:          'test_task',
  description:   'I will get tested and set some config options',
  queue:         'default',
  plugins:       [],
  pluginOptions: [],
  frequency:     0,
  run: function(api, params, next){
    api.config.test.task = 'OK';
    next();
  }
};

exports.task = task;
