exports.showDocumentation = {
  name: 'showDocumentation',
  description: 'return API documentation',

  outputExample:{
    'documentation':{
      'cacheTest':{
        '1':{
          'name':'cacheTest',
          'version':1,
          'description':'I will test the internal cache functions of the API',
          'inputs':{
            'key':{
              'required':true
            },
            'value':{
              'required':true
            }
          },
          'outputExample':{
            'cacheTestResults':{
              'saveResp':true,
              'sizeResp':1,
              'loadResp':{
                'key':'',
                'value':'value',
                'expireTimestamp':1420953274716,
                'createdAt':1420953269716,
                'readAt':null
              },
              'deleteResp':true
            }
          }
        }
      },
      'randomNumber':{
        '1':{
          'name':'randomNumber',
          'version':1,
          'description':'I am an API method which will generate a random number',
          'inputs':{

          },
          'outputExample':{
            'randomNumber':0.123
          }
        }
      },
      'showDocumentation':{
        '1':{
          'name':'showDocumentation',
          'version':1,
          'description':'return API documentation',
          'inputs':{

          }
        }
      },
      'sleepTest':{
        '1':{
          'name':'sleepTest',
          'version':1,
          'description':'I will sleep and then return',
          'inputs':{
            'sleepDuration':{
              'required':true
            }
          }
        }
      },
      'status':{  
        '1':{
          'name':'status',
          'version':1,
          'description':'I will return some basic information about the API',
          'inputs':{

          }
        }
      }
    }
  },

  run: function(api, data, next){
    data.response.documentation = api.documentation.documentation;
    next();
  }
};
