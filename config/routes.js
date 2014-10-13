exports.default = { 
  routes: function(api){
    return {
      
      /* ---------------------
      routes.js 

      For web clients (http and https) you can define an optional RESTful mapping to help route requests to actions.
      If the client doesn't specify and action in a param, and the base route isn't a named action, the action will attempt to be discerned from this routes.js file.

      - actions defined in params directly 'action=theAction' or hitting the named URL for an action '/api/theAction' will always override RESTful routing
      - you can mix explicitly defined params with route-defined params.  If there is an overlap, the route-defined params win
        - IE: /api/user/123?userId=456 => 'connection.userId = 123'
        - this is a change from previous versions
      - routes defined with the 'all' method will be duplicated to 'get', 'put', 'post', and 'delete'
      - use ':variable' to defined 'variable'
      - undefined ':variable' will match
        - IE: '/api/user/' WILL match '/api/user/:userId'
      - routes are matched as defined here top-down
      - you can optionally define a regex match along with your route variable
        - IE: { path:'/game/:id(^[a-z]{0,10}$)', action: 'gamehandler' }
        - be sure to double-escape when needed: { path: '/login/:userID(^\\d{3}$)', action: 'login' }

      example:
      
      get: [
        { path: '/users', action: 'usersList' }, // (GET) /api/users
        { path: '/search/:term/limit/:limit/offset/:offset', action: 'search' }, // (GET) /api/search/car/limit/10/offset/100
      ],

      post: [
        { path: '/login/:userID(^\\d{3}$)', action: 'login' } // (POST) /api/login/123
      ],

      all: [
        { path: '/user/:userID', action: 'user' } // (*) / /api/user/123
      ]
      
      ---------------------- */
      
    }
  }
}