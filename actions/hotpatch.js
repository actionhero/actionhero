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

    api.redis.doCluster('api.eval', {filename: data.params.filename, contents: data.params.contents});

    next(error);
  }
};
