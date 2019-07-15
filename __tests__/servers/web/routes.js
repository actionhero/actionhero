'use strict'

const request = require('request-promise-native')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ActionHero = require(path.join(__dirname, '/../../../index.js'))
const actionhero = new ActionHero.Process()
let api
let url

const toJson = async (string) => {
  try {
    return JSON.parse(string)
  } catch (error) {
    return error
  }
}

describe('Server: Web', () => {
  beforeAll(async () => {
    api = await actionhero.start()
    url = 'http://localhost:' + api.config.servers.web.port
  })

  afterAll(async () => { await actionhero.stop() })

  describe('routes', () => {
    let originalRoutes
    beforeAll(() => {
      originalRoutes = api.routes.routes
      api.actions.versions.mimeTestAction = [1]
      api.actions.actions.mimeTestAction = {
        1: {
          name: 'mimeTestAction',
          description: 'I am a test',
          matchExtensionMimeType: true,
          inputs: {
            key: { required: true },
            path: { required: false }
          },
          outputExample: {},
          run: (data) => {
            data.response.matchedRoute = data.connection.matchedRoute
          }
        }
      }

      api.actions.versions.login = [1, 2]
      api.actions.actions.login = {
        1: {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            user_id: { required: true }
          },
          outputExample: {},
          run: (data) => {
            data.response.user_id = data.params.user_id
          }
        },

        2: {
          name: 'login',
          description: 'login',
          matchExtensionMimeType: true,
          inputs: {
            userID: { required: true }
          },
          outputExample: {},
          run: (data) => {
            data.response.userID = data.params.userID
          }
        }
      }

      api.params.buildPostVariables()
      api.routes.loadRoutes({
        all: [
          { path: '/user/:userID', action: 'user' }
        ],
        get: [
          { path: '/bogus/:bogusID', action: 'bogusAction' },
          { path: '/users', action: 'usersList' },
          { path: '/c/:key/:value', action: 'cacheTest' },
          { path: '/mimeTestAction/:key', action: 'mimeTestAction' },
          { path: '/thing', action: 'thing' },
          { path: '/thing/stuff', action: 'thingStuff' },
          { path: '/old_login', action: 'login', apiVersion: '1' },
          { path: '/a/wild/:key/:path(^.*$)', action: 'mimeTestAction', apiVersion: '1', matchTrailingPathParts: true }
        ],
        post: [
          { path: '/login/:userID(^(\\d{3}|admin)$)', action: 'login' }
        ]
      })
    })

    afterAll(() => {
      api.routes.routes = originalRoutes
      delete api.actions.versions.mimeTestAction
      delete api.actions.actions.mimeTestAction
      delete api.actions.versions.login
      delete api.actions.actions.login
    })

    test(
      'new params will not be allowed in route definitions (an action should do it)',
      () => {
        expect(api.params.postVariables).not.toContain('bogusID')
      }
    )

    describe('simple routing', () => {
      describe('deep routes', () => {
        beforeAll(() => {
          api.config.servers.web.urlPathForActions = 'namespace/actions'
          api.config.servers.web.urlPathForFiles = 'namespace/files'
        })

        afterAll(() => {
          api.config.servers.web.urlPathForActions = 'api'
          api.config.servers.web.urlPathForFiles = 'public'
        })

        test('old action routes stop working', async () => {
          try {
            await request.get(url + '/api/randomNumber')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(404)
          }
        })

        test('can ask for nested URL actions', async () => {
          const response = await request.get(url + '/namespace/actions/randomNumber', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
        })

        test('old file routes stop working', async () => {
          try {
            await request.get(url + '/public/simple.html')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(404)
          }
        })

        test('can ask for nested URL files', async () => {
          const response = await request.get(url + '/namespace/files/simple.html', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
          expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        })

        test('can ask for nested URL files with depth', async () => {
          const response = await request.get(url + '/namespace/files/css/cosmo.css', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
        })

        test('root route files still work', async () => {
          const response = await request.get(url + '/simple.html', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
          expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        })
      })

      describe('very deep routes', () => {
        beforeAll(() => {
          api.config.servers.web.urlPathForActions = '/craz/y/action/path'
          api.config.servers.web.urlPathForFiles = '/a/b/c'
        })

        afterAll(() => {
          api.config.servers.web.urlPathForActions = 'api'
          api.config.servers.web.urlPathForFiles = 'public'
        })

        test('old action routes stop working', async () => {
          try {
            await request.get(url + '/api/randomNumber')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(404)
          }
        })

        test('can ask for nested URL actions', async () => {
          const response = await request.get(url + '/craz/y/action/path/randomNumber', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
        })

        test('old file routes stop working', async () => {
          try {
            await request.get(url + '/public/simple.html')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(404)
          }
        })

        test('can ask for nested URL files', async () => {
          const response = await request.get(url + '/a/b/c/simple.html', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
          expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        })

        test('can ask for nested URL files with depth', async () => {
          const response = await request.get(url + '/a/b/c/css/cosmo.css', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
        })

        test('root route files still work', async () => {
          const response = await request.get(url + '/simple.html', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
          expect(response.body).toEqual('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />')
        })
      })
    })

    test('\'all\' routes are duplicated properly', () => {
      api.routes.registerRoute('all', '/other-login', 'login')
      const loaded = {}
      const registered = {}
      api.routes.verbs.forEach((verb) => {
        api.routes.routes[verb].forEach((route) => {
          if (!loaded[verb]) loaded[verb] = route.action === 'user' && route.path === '/user/:userID'
          if (!registered[verb]) registered[verb] = route.action === 'login' && route.path === '/other-login'
        })
      })
      expect(Object.keys(loaded).length).toEqual(api.routes.verbs.length)
      expect(Object.keys(registered).length).toEqual(api.routes.verbs.length)
    })

    test('unknown actions are still unknown', async () => {
      try {
        await request.get(url + '/api/a_crazy_action')
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.error).toEqual('unknown action or invalid apiVersion')
      }
    })

    test(
      'explicit action declarations still override routed actions, if the defined action is real',
      async () => {
        const body = await request.get(url + '/api/user/123?action=randomNumber').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('randomNumber')
      }
    )

    test(
      'route actions will override explicit actions, if the defined action is null',
      async () => {
        try {
          await request.get(url + '/api/user/123?action=someFakeAction').then(toJson)
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          const body = await toJson(error.response.body)
          expect(body.requesterInformation.receivedParams.action).toEqual('user')
        }
      }
    )

    test(
      'returns application/json when the mime type cannot be determined for an action',
      async () => {
        const response = await request.get(url + '/api/mimeTestAction/thing.bogus', { resolveWithFullResponse: true })
        expect(response.headers['content-type']).toMatch(/json/)
        const body = JSON.parse(response.body)
        expect(body.matchedRoute.path).toEqual('/mimeTestAction/:key')
        expect(body.matchedRoute.action).toEqual('mimeTestAction')
      }
    )

    test(
      'route actions have the matched route availalbe to the action',
      async () => {
        const body = await request.get(url + '/api/mimeTestAction/thing.json').then(toJson)
        expect(body.matchedRoute.path).toEqual('/mimeTestAction/:key')
        expect(body.matchedRoute.action).toEqual('mimeTestAction')
      }
    )

    test('Routes should recognize apiVersion as default param', async () => {
      const body = await request.get(url + '/api/old_login?user_id=7').then(toJson)
      expect(body.user_id).toEqual('7')
      expect(body.requesterInformation.receivedParams.action).toEqual('login')
    })

    test('Routes should be mapped for GET (simple)', async () => {
      try {
        await request.get(url + '/api/users').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('usersList')
      }
    })

    test('Routes should be mapped for GET (complex)', async () => {
      try {
        await request.get(url + '/api/user/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
      }
    })

    test('Routes should be mapped for POST', async () => {
      try {
        await request.post(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('Routes should be mapped for PUT', async () => {
      try {
        await request.put(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('Routes should be mapped for DELETE', async () => {
      try {
        await request.del(url + '/api/user/1234?key=value').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1234')
        expect(body.requesterInformation.receivedParams.key).toEqual('value')
      }
    })

    test('route params trump explicit params', async () => {
      try {
        await request.get(url + '/api/user/1?userID=2').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('user')
        expect(body.requesterInformation.receivedParams.userID).toEqual('1')
      }
    })

    test('to match, a route much match all parts of the URL', async () => {
      try {
        await request.get(url + '/api/thing').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('thing')
      }

      try {
        await request.get(url + '/api/thing/stuff').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.requesterInformation.receivedParams.action).toEqual('thingStuff')
      }
    })

    test('regexp matches will provide proper variables', async () => {
      const body = await request.post(url + '/api/login/123').then(toJson)
      expect(body.requesterInformation.receivedParams.action).toEqual('login')
      expect(body.requesterInformation.receivedParams.userID).toEqual('123')

      const bodyAgain = await request.post(url + '/api/login/admin').then(toJson)
      expect(bodyAgain.requesterInformation.receivedParams.action).toEqual('login')
      expect(bodyAgain.requesterInformation.receivedParams.userID).toEqual('admin')
    })

    test(
      'regexp matches will still work with params with periods and other wacky chars',
      async () => {
        const body = await request.get(url + '/api/c/key/log_me-in.com$123.').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('cacheTest')
        expect(body.requesterInformation.receivedParams.value).toEqual('log_me-in.com$123.')
      }
    )

    test('regexp match failures will be rejected', async () => {
      try {
        await request.get(url + '/api/login/1234').then(toJson)
        throw new Error('should not get here')
      } catch (error) {
        expect(error.statusCode).toEqual(404)
        const body = await toJson(error.response.body)
        expect(body.error).toEqual('unknown action or invalid apiVersion')
        expect(body.requesterInformation.receivedParams.userID).toBeUndefined()
      }
    })

    describe('file extensions + routes', () => {
      test(
        'will change header information based on extension (when active)',
        async () => {
          const response = await request.get(url + '/api/mimeTestAction/val.png', { resolveWithFullResponse: true })
          expect(response.headers['content-type']).toEqual('image/png')
        }
      )

      test(
        'will not change header information if there is a connection.error',
        async () => {
          try {
            await request.get(url + '/api/mimeTestAction')
            throw new Error('should not get here')
          } catch (error) {
            expect(error.statusCode).toEqual(422)
            const body = await toJson(error.response.body)
            expect(error.response.headers['content-type']).toEqual('application/json; charset=utf-8')
            expect(body.error).toEqual('key is a required parameter for this action')
          }
        }
      )

      test('works with with matchTrailingPathParts', async () => {
        const body = await request.get(url + '/api/a/wild/theKey/and/some/more/path').then(toJson)
        expect(body.requesterInformation.receivedParams.action).toEqual('mimeTestAction')
        expect(body.requesterInformation.receivedParams.path).toEqual('and/some/more/path')
        expect(body.requesterInformation.receivedParams.key).toEqual('theKey')
      })
    })

    describe('spaces in URL with public files', () => {
      const source = path.join(__dirname, '/../../../public/logo/actionhero.png')

      beforeAll(async () => {
        const tmpDir = os.tmpdir()
        const readStream = fs.createReadStream(source)
        api.staticFile.searchLoactions.push(tmpDir)

        await new Promise((resolve) => {
          readStream.pipe(fs.createWriteStream(tmpDir + path.sep + 'actionhero with space.png'))
          readStream.on('close', resolve)
        })
      })

      afterAll(() => {
        fs.unlinkSync(os.tmpdir() + path.sep + 'actionhero with space.png')
        api.staticFile.searchLoactions.pop()
      })

      test(
        'will decode %20 or plus sign to a space so that file system can read',
        async () => {
          const response = await request.get(url + '/actionhero%20with%20space.png', { resolveWithFullResponse: true })
          expect(response.statusCode).toEqual(200)
          expect(response.body).toMatch(/PNG/)
          expect(response.headers['content-type']).toEqual('image/png')
        }
      )

      test('will capture bad encoding in URL and return NOT FOUND', async () => {
        try {
          await request.get(url + '/actionhero%20%%%%%%%%%%with+space.png')
          throw new Error('should not get here')
        } catch (error) {
          expect(error.statusCode).toEqual(404)
          expect(typeof error.response.body).toEqual('string')
          expect(error.response.body).toMatch(/^That file is not found/)
        }
      })
    })
  })

  describe('manually set routes persist a reload', () => {
    let originalRoutes
    beforeAll(() => { originalRoutes = api.routes.routes })
    afterAll(() => { api.routes.routes = originalRoutes })

    test('it remembers manually loaded routes', async () => {
      api.routes.registerRoute('get', '/a-custom-route', 'randomNumber')
      const response = await request.get(url + '/api/a-custom-route', { resolveWithFullResponse: true })
      expect(response.statusCode).toEqual(200)

      api.routes.loadRoutes()

      const responseAgain = await request.get(url + '/api/a-custom-route', { resolveWithFullResponse: true })
      expect(responseAgain.statusCode).toEqual(200)
    })
  })
})
