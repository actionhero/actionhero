// I override settings in ../config.js for this environment
// these changes will be merged on top of those in config.js

var config = {}

//

config.general = {
  developmentMode: false
}

config.servers = {
  web: {
    metadataOptions: {
      serverInformation: false,
      requesterInformation: false
    }
  }
}

//

exports.config = config;
