exports.action = {
  name:                   '%%name%%',
  description:            '%%description%%',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,

  inputs: {},

  run: function(api, data, next){
    var error = null;

    // your logic here
    
    next(error);
  }
};