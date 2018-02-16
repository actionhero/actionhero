'use strict'

exports['default'] = {
  servers: {
    lambda: (api) => {
      return {
        enabled: true,
        returnMetadata: true,
        shutdownAfterRequest: true
      }
    }
  }
}

exports['production'] = {
  servers: {
    lambda: (api) => {
      return {
        enabled: true,
        returnMetadata: false,
        shutdownAfterRequest: false
      }
    }
  }
}
