'use strict'

const path = require('path')

module.exports = {
  loadPriority: 500,
  initialize: function (api, next) {
    api.routes = {}
    api.routes.routes = {}
    api.routes.verbs = ['head', 'get', 'post', 'put', 'patch', 'delete']

    // //////////////////////////////////////////////////////////////////////////
    // route processing for web clients
    api.routes.processRoute = function (connection, pathParts) {
      if (connection.params.action === undefined || api.actions.actions[connection.params.action] === undefined) {
        let method = connection.rawConnection.method.toLowerCase()
        if (method === 'head' && !api.routes.routes.head) { method = 'get' }
        for (let i in api.routes.routes[method]) {
          const route = api.routes.routes[method][i]
          const match = api.routes.matchURL(pathParts, route.path, route.matchTrailingPathParts)
          if (match.match === true) {
            if (route.apiVersion) {
              connection.params.apiVersion = connection.params.apiVersion || route.apiVersion
            }

            for (let param in match.params) {
              try {
                const decodedName = decodeURIComponent(param.replace(/\+/g, ' '))
                const decodedValue = decodeURIComponent(match.params[param].replace(/\+/g, ' '))
                connection.params[decodedName] = decodedValue
              } catch (e) {
                // malformed URL
              }
            }
            connection.matchedRoute = route

            if (route.dir) {
              const requestedFile = connection.rawConnection.parsedURL.pathname.substring(route.path.length, connection.rawConnection.parsedURL.pathname.length)
              connection.params.file = path.normalize(route.dir + '/' + requestedFile)
            } else {
              connection.params.action = route.action
            }
            break
          }
        }
      }
    }

    api.routes.matchURL = function (pathParts, match, matchTrailingPathParts) {
      let response = {match: false, params: {}}
      let matchParts = match.split('/')
      let regexp = ''
      let variable = ''

      if (matchParts[0] === '') { matchParts.splice(0, 1) }
      if (matchParts[(matchParts.length - 1)] === '') { matchParts.pop() }

      if (matchParts.length !== pathParts.length && matchTrailingPathParts !== true) {
        return response
      }

      for (let i in matchParts) {
        let matchPart = matchParts[i]
        let pathPart = pathParts[i]

        if (matchTrailingPathParts === true && parseInt(i) === (matchParts.length - 1)) {
          for (let j in pathParts) {
            if (j > i) { pathPart = pathPart + '/' + pathParts[j] }
          }
        }

        if (!pathPart) {
          return response
        } else if (matchPart[0] === ':' && matchPart.indexOf('(') < 0) {
          variable = matchPart.replace(':', '')
          response.params[variable] = pathPart
        } else if (matchPart[0] === ':' && matchPart.indexOf('(') >= 0) {
          variable = matchPart.replace(':', '').split('(')[0]
          regexp = matchPart.substring(matchPart.indexOf('(') + 1, matchPart.length - 1)
          let matches = pathPart.match(new RegExp(regexp, 'g'))
          if (matches) {
            response.params[variable] = pathPart
          } else {
            return response
          }
        } else {
          if (
            pathPart === null ||
            pathPart === undefined ||
            pathParts[i].toLowerCase() !== matchPart.toLowerCase()
          ) {
            return response
          }
        }
      }

      response.match = true
      return response
    }

    // don't ever remove this!
    // this is really handy for plugins
    api.routes.registerRoute = function (method, path, action, apiVersion, matchTrailingPathParts, dir) {
      if (!matchTrailingPathParts) { matchTrailingPathParts = false }
      api.routes.routes[method].push({
        path: path,
        matchTrailingPathParts: matchTrailingPathParts,
        action: action,
        dir: dir,
        apiVersion: apiVersion
      })
    }

    // load in the routes file
    api.routes.loadRoutes = function (rawRoutes) {
      let counter = 0

      api.routes.routes = {'head': [], 'get': [], 'post': [], 'put': [], 'patch': [], 'delete': []}

      if (!rawRoutes) {
        if (api.config.routes) {
          rawRoutes = api.config.routes
        }
      }

      let v
      let verb
      for (let i in rawRoutes) {
        let method = i.toLowerCase()
        for (let j in rawRoutes[i]) {
          let route = rawRoutes[i][j]
          if (method === 'all') {
            for (v in api.routes.verbs) {
              verb = api.routes.verbs[v]
              api.routes.registerRoute(verb, route.path, route.action, route.apiVersion, route.matchTrailingPathParts, route.dir)
            }
          } else {
            api.routes.registerRoute(method, route.path, route.action, route.apiVersion, route.matchTrailingPathParts, route.dir)
          }
          counter++
        }
      }

      api.params.postVariables = api.utils.arrayUniqueify(api.params.postVariables)
      api.log(['%s routes loaded from %s', counter, api.routes.routesFile], 'debug')

      if (api.config.servers.web && api.config.servers.web.simpleRouting === true) {
        let simplePaths = []
        for (let action in api.actions.actions) {
          simplePaths.push('/' + action)
          // api.routes.verbs.forEach(function(verb){
          for (v in api.routes.verbs) {
            verb = api.routes.verbs[v]
            api.routes.registerRoute(verb, '/' + action, action)
          }
        }
        api.log(['%s simple routes loaded from action names', simplePaths.length], 'debug')

        api.log('routes:', 'debug', api.routes.routes)
      }
    }

    api.routes.loadRoutes()
    next()
  }
}
