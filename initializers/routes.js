'use strict'

const path = require('path')
const ActionHero = require('./../index.js')
const api = ActionHero.api

/**
 * Countains routing options for web clients.  Can associate routes with actions or files.
 *
 * @namespace api.routes
 * @property {Object} routes - This servers routes, defined.
 * @property {Object} verbs - The HTTP verbs we can use, ['head', 'get', 'post', 'put', 'patch', 'delete'].
 * @extends ActionHero.Initializer
 */
module.exports = class Routes extends ActionHero.Initializer {
  constructor () {
    super()
    this.name = 'routes'
    this.loadPriority = 500
  }

  initialize () {
    api.routes = {
      routes: {},
      verbs: ['head', 'get', 'post', 'put', 'patch', 'delete']
    }

    api.routes.processRoute = (connection, pathParts) => {
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

    api.routes.matchURL = (pathParts, match, matchTrailingPathParts) => {
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

    /**
     * Programatically define a route, rather than using `api.config.routes`.  This is useful for plugins which may define routes as well.
     * You can use both `api.routes.registerRoute` and `api.config.routes` in the same project.
     *
     * @param  {string} method                 HTTP verb (get, put, etc)
     * @param  {string} path                   The route in question.  Can use variables.
     * @param  {string} action                 The action to call with this route.
     * @param  {Number} apiVersion             The version of the action to call, if more than one.
     * @param  {Boolean} matchTrailingPathParts Allows the final segment of your route to absorb all trailing path parts in a matched variable. (ie: /api/user would match /api/user/123)
     * @param  {string} dir                    Which folder to serve static files from (must by included in api.config.general.paths)
     */
    api.routes.registerRoute = (method, path, action, apiVersion, matchTrailingPathParts, dir) => {
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
    api.routes.loadRoutes = (rawRoutes) => {
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
      api.log(`${counter} routes loaded from ${api.routes.routesFile}`, 'debug')

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
        api.log(`${simplePaths.length} simple routes loaded from action names`, 'debug')

        api.log('routes:', 'debug', api.routes.routes)
      }
    }

    api.routes.loadRoutes()
  }
}
