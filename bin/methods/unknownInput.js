'use strict';

exports.unknownInput = function(binary, next){
  binary.log('\'' + binary.mainAction + '\' is not a known action', 'warning');

  // TODO: Delete these deprecated warnings in next major actionhero version (v16)
  if(binary.mainAction == 'generateAction'){
    binary.log('`actionhero generateAction` command no longer in use.', 'warning');
    binary.log('use `actionhero generate action <name>` instead.', 'warning');
  }
  if(binary.mainAction == 'generateInitializer'){
    binary.log('`actionhero generateInitializer` command no longer in use.', 'warning');
    binary.log('use `actionhero generate initializer <name>` instead.', 'warning');
  }
  if(binary.mainAction == 'generateServer'){
    binary.log('`actionhero generateServer` command no longer in use.', 'warning');
    binary.log('use `actionhero generate server <name>` instead.', 'warning');
  }
  if(binary.mainAction == 'generateTask'){
    binary.log('`actionhero generateTask` command no longer in use.', 'warning');
    binary.log('use `actionhero generate task <name>` instead.', 'warning');
  }

  binary.log('run \'actionhero help\' for more information', 'warning');
  next(true);
};
