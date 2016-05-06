'use strict';

exports.action = {
  name:                   'hotpatch',
  description:            'hotpatch',
  blockedConnectionTypes: [],
  outputExample:          {},
  matchExtensionMimeType: false,
  version:                1.0,
  toDocument:             true,
  middleware:             [],

  inputs: {
    filename: {
      required: true
    },
    contents: {
      required: true
    }
  },

  run: function(api, data, next) {
    let error = null;

    const params = {filename: data.params.filename, contents: data.params.contents};

    api.redis.doCluster('api.eval', params, null, ()=>{
      if(!api.config.general.developmentMode && process.send){
        process.send({
          hotreload: true
        }, (err)=>{
          next(err);
        });
      } else {
        error = new Error("Cannot hotpatch for various sundry reasons");
        next(error);
      }
    });
  }
};
