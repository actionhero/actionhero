'use strict'
const ActionHero = require('./../index.js')

module.exports = class CacheTest extends ActionHero.Action {
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

  async run (api, data) {
    const key = 'cacheTest_' + data.params.key
    const value = data.params.value

    data.response.cacheTestResults = {}

    data.response.cacheTestResults.saveResp = await api.cache.save(key, value, 5000)
    data.response.cacheTestResults.sizeResp = await api.cache.size()
    data.response.cacheTestResults.loadResp = await api.cache.load(key)
    data.response.cacheTestResults.deleteResp = await api.cache.destroy(key)
  }
}
