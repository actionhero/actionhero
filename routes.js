/* ---------------------
routes.js 

For web clients (http and https) you can define an optional RESTful mapping to help route requests to actions.
If the client doesn't specify and action in a param, and the base route isn't a named action, the action will attempt to be discerned from this routes.js file.

- routes remain optional
- actions defiend in params directly `action=theAction` or hitting the named URL for an action `/api/theAction` will always override RESTful routing 
- the hierarchy of the routes object is prefix --> REST verb -> data
- you can mix explicitly defined params with route-defined params.  If there is an overlap, the explicitly defined params win
- data contains the 'action' to map to, and then an optional urlMap (api.params.mapParamsFromURL)
- only single depth routes are supported at this time

/////////////
// EXAMPLE //
/////////////

exports.routes = {
  
  users: {
    get: {
      action: "usersList", // (GET) /api/users
    }
  },

  user : {
    get: {
      action: "userAdd",
      urlMap: ["userID"], // (GET) /api/user/123
    },
    post: {
      action: "userEdit",
      urlMap: ["userID"] // (POST) /api/user/123
    },
    put: {
      action: "userAdd",
      urlMap: ["type", "screenName"] // (PUT) /api/user/admin/handle123
    },
    delete: {
      action: "userDelete",
      urlMap: ["userID"] // (DELETE) /api/user/123
    }
  }

};

---------------------- */

exports.routes = {};