'use strict'

exports['default'] = {
  servers: {
    lambda: (api) => {
      return {
        enabled: true,
        returnMetadata: true
      }
    }
  }
}
