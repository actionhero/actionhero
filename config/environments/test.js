// I override settings in ../config.js for this environment
// these changes will be merged on top of those in config.js

var toFakeRedis = false;
if(process.env['fakeredis'] != null && process.env['fakeredis'] == 'true'){
	toFakeRedis = true
}

var redisConfig = {
  'fake': toFakeRedis,
  'host': '127.0.0.1',
  'port': 6379,
  'password': null,
  'options': null,
  'DB': 2
}

var config = {
  general: {
    id: 'test-server',
    developmentMode: true,
    startingChatRooms: {
      'defaultRoom': {},
      'otherRoom': {},
      'secureRoom': {authorized: true}
    }
  },
  logger: {
    transports: null
  },
  stats: {
    writeFrequency: 0,
    keys: ['test:stats']
  },
  redis : redisConfig,
  tasks : {
    scheduler: false,
    timeout: 100,
    queues: [],
    redis: redisConfig
  },
  faye: {
    mount: '/faye',
    timeout: 45,
    ping: null,
    redis: redisConfig,
    namespace: 'faye:'
  },
  servers: {
    web: {
      secure: false,
      port: 8081,
      matchExtensionMime: true,
      metadataOptions: {
        serverInformation: true,
        requesterInformation: true
      }
    },
    socket: {
      port: 5001,
      secure: false
    },
    websocket: {}
  }
};

//

exports.config = config;
