[1mdiff --git a/config/config.js b/config/config.js[m
[1mindex 00b5d2d..2c49c4e 100755[m
[1m--- a/config/config.js[m
[1m+++ b/config/config.js[m
[36m@@ -43,6 +43,10 @@[m [mconfig.general = {[m
     'server':      __dirname + '/../servers',[m
     'initializer': __dirname + '/../initializers'[m
   },[m
[32m+[m[32m  //Hash of folders within 'public' for different domains; if domain name isn't found, defaults to public filepath[m
[32m+[m[32m  domains: {[m
[32m+[m[41m	[m
[32m+[m[32m  },[m
   // hash containing chat rooms you wish to be created at server boot [m
   startingChatRooms: {[m
     // format is {roomName: {authKey, authValue}}[m
[36m@@ -159,7 +163,7 @@[m [mconfig.servers = {[m
     // Passed to https.createServer if secure=true. Should contain SSL certificates[m
     serverOptions: {},[m
     // Port or Socket[m
[31m-    port: 8080,[m
[32m+[m[32m    port: 80,[m
     // Which IP to listen on (use '0.0.0.0' for all; '::' for all on ipv4 and ipv6)[m
     bindIP: '0.0.0.0',[m
     // Any additional headers you want actionHero to respond with[m
[1mdiff --git a/initializers/staticFile.js b/initializers/staticFile.js[m
[1mindex d1e0ff4..de7a447 100644[m
[1m--- a/initializers/staticFile.js[m
[1m+++ b/initializers/staticFile.js[m
[36m@@ -13,8 +13,13 @@[m [mvar staticFile = function(api, next){[m
       if(connection.params.file == null){[m
         self.sendFileNotFound(connection, 'file is a required param to send a file', callback);[m
       } else {[m
[31m-        var file = path.normalize(api.config.general.paths.public + '/' + connection.params.file);[m
[31m-        if(file.indexOf(path.normalize(api.config.general.paths.public)) != 0){[m
[32m+[m[41m	[m
[32m+[m		[32mvar file = path.join(api.config.general.paths.public,[m
[32m+[m			[32m(connection.rawConnection.req.headers.host in api.config.general.domains)?[m
[32m+[m			[32mapi.config.general.domains[connection.rawConnection.req.headers.host]:'',[m
[32m+[m			[32mconnection.params.file);[m
[32m+[m
[32m+[m[41m     [m	[32mif(file.indexOf(path.normalize(file)) != 0){[m
           self.sendFileNotFound(connection, 'that is not a valid file path', callback);[m
         } else {[m
           self.checkExistence(file, function(exists){[m
