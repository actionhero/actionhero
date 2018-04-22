exports['default'] = {
  routes: (api) => {
    return {

      get: [
        { path: 'random-number', action: 'randomNumber' }
      ]

    }
  }
}
