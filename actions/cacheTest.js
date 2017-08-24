'use strict'

exports.cacheTest = {
  name: 'cacheTest',
  description: 'I will test the internal cache functions of the API',

  outputExample: {
    cacheTestResults: {
      saveResp: true,
      sizeResp: 1,
      loadResp: {
        key: 'cacheTest_key',
        value: 'value',
        expireTimestamp: 1420953274716,
        createdAt: 1420953269716,
        readAt: null
      },
      deleteResp: true
    }
  },

  inputs: {
    key: {
      required: true,
      formatter: function (s) { return String(s) }
    },
    value: {
      required: true,
      formatter: function (s) { return String(s) },
      validator: function (s) {
        if (s.length < 3) {
          return '`value` should be at least 3 letters long'
        } else { return true }
      }
    }
  },

  run: async function (api, data, next) {
    const key = 'cacheTest_' + data.params.key
    const value = data.params.value

    data.response.cacheTestResults = {}

    try {
      data.response.cacheTestResults.saveResp = await api.cache.save(key, value, 5000)
      data.response.cacheTestResults.sizeResp = await api.cache.size()
      data.response.cacheTestResults.loadResp = await api.cache.load(key)
      data.response.cacheTestResults.deleteResp = await api.cache.destroy(key)
      next()
    } catch (error) {
      next(error)
    }
  }

}
