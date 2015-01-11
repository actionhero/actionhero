exports.action = {
  name:                   '%%name%%',
  description:            '%%description%%',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,

  inputs: {},

  run: function(api, connection, next){
    // your logic here
    next(connection, true);
  }
};