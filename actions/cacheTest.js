'use strict'
const {Action, api} = require('./../index.js')

module.exports = class CacheTest extends Action {
  constructor () {
    super()
    this.name = 'cacheTest'
    this.description = 'I will test the internal cache functions of the API'
    this.outputExample = {
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
    }
  }

  inputs () {
    return {
      key: {
        required: true,
        formatter: this.stringFormatter,
        validator: this.stringValidator
      },

      value: {
        required: true,
        formatter: this.stringFormatter,
        validator: this.stringValidator
      }
    }
  }

  stringFormatter (s) {
    return String(s)
  }

  stringValidator (s) {
    if (s.length < 3) {
      return 'inputs should be at least 3 letters long'
    } else {
      return true
    }
  }

  async run ({params, response}) {
    const key = 'cacheTest_' + params.key
    const value = params.value

    response.cacheTestResults = {
      saveResp: await api.cache.save(key, value, 5000),
      sizeResp: await api.cache.size(),
      loadResp: await api.cache.load(key),
      deleteResp: await api.cache.destroy(key)
    }
  }
}
