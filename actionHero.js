////////////////////////////////////////////////////////////////////////////
// actionHero Framweork in node.js
// evan@evantahler.com 
// https://github.com/evantahler/actionHero

var fs = require("fs");
var path = require("path");
var async = require('async');

// backwards compatibility for old node versions
fs.existsSync || (fs.existsSync = path.existsSync);
fs.exists || (fs.exists = path.exists);

var actionHero = function(){
    var self = this;
    self.initalizers = {};
    self.api = {};
    try{ self.api.domain = require("domain"); }catch(e){ }
};


actionHero.prototype.start = function(params, next){
    var self = this;
    self.api._self = self;
    self.api._commands = {
        start: self.start,
        stop: self.stop,
        restart: self.restart,
    };

    if (params === null){ params = {}; }
    self.startingParams = params;

    var initializerFolders = [
        __dirname + "/initializers/"
    ];

    //Load the Core ininitalizer methods from AH
    var initializerMethods = [];
    for(var i in initializerFolders){
        var folder = initializerFolders[i];
        if(fs.existsSync(folder)){
            fs.readdirSync(folder).sort().forEach( function(file) {
                if (file[0] != "."){
                    var initalizer = file.split(".")[0];
                    if(require.cache[initializerFolders[i] + file] !== null){
                        delete require.cache[initializerFolders[i] + file];
                    }
                    initializerMethods.push(initalizer);
                    self.initalizers[initalizer] = require(initializerFolders[i] + file)[initalizer];
                }
            });
        }
    }

    // Load Custom Initializer methods stored in custom folder
    var customInitializerFolder = [
        process.cwd() + "/initializers/"
    ];
    var customInitializerMethods = [];
    for(var i in customInitializerFolder){
        var folder = customInitializerFolder[i];
        if(fs.existsSync(folder)){
            fs.readdirSync(folder).sort().forEach( function(file) {
                if (file[0] != "."){
                    var initalizer = file.split(".")[0];
                    if(require.cache[customInitializerFolder[i] + file] !== null){
                        delete require.cache[customInitializerFolder[i] + file];
                    }
                    customInitializerMethods.push(initalizer);
                    self.initalizers[initalizer] = require(customInitializerFolder[i] + file)[initalizer];
                }
            });
        }
    }

    // First, load the Config for the Initializer startup queue
    self.initalizers['config'](self.api, self.startingParams);

    var orderedInitializers = {};
    orderedInitializers['startup'] = function(next){ next(); };
    // Load all core initializers given in the config
    self.api.configData.general.startupInitializers.forEach(function(I){
        orderedInitializers[I] = function(next){ self.initalizers[I](self.api, next) };
    });


    var customStartupQueue = self.api.configData.general.startupCustomInitializers;
    customInitializerMethods.forEach(function(method){
        if(typeof orderedInitializers[method] != "function" && customStartupQueue.indexOf(method) != -1){
            orderedInitializers[method] = function(next){
                self.api.log("running custom initalizer: " + method);
                self.initalizers[method](self.api, next);

            };
        }
    });

    orderedInitializers['_complete'] = function(){
        self.api.running = true;
        var starters = [];
        for(var i in self.api){
            if(typeof self.api[i]._start == "function"){
                starters.push(i);
            }
        }

        var started = 0;
        var successMessage = "*** Server Started @ " + self.api.utils.sqlDateTime() + " ***";
        if(starters.length == 0){
            self.api.bootTime = new Date().getTime();
            self.api.log("server ID: " + self.api.id);
            self.api.log(successMessage, ["green", "bold"]);
            if(next !== null){
                next(null, self.api);
            }
        }else{
            starters.forEach(function(starter){
                started++;
                self.api[starter]._start(self.api, function(){
                    process.nextTick(function(){
                        self.api.log(" > start: " + starter, 'grey');
                        started--;
                        if(started == 0){
                            self.api.bootTime = new Date().getTime();
                            self.api.log("server ID: " + self.api.id);
                            self.api.log(successMessage, ["green", "bold"]);
                            if(next !== null){
                                next(null, self.api);
                            }
                        }
                    });
                });
            });
        }
    };

    async.series(orderedInitializers);
};

actionHero.prototype.stop = function(next){
    var self = this;
    if(self.api.running === true){
        self.api.running = false;
        self.api.log("Shutting down open servers and stopping task processing", "bold");

        var orderedTeardowns = {};
        orderedTeardowns['watchedFiles'] = function(next){
            self.api.log(" > teardown: watchedFiles", 'grey');
            for(var i in self.api.watchedFiles){
                fs.unwatchFile(self.api.watchedFiles[i]);
            }
            next();
        }

        for(var i in self.api){
            if(typeof self.api[i]._teardown == "function"){
                (function(name) {
                    orderedTeardowns[name] = function(next){
                        self.api.log(" > teardown: " + name, 'grey');
                        self.api[name]._teardown(self.api, next);
                    };
                })(i);
            }
        }

        orderedTeardowns['_complete'] = function(){
            self.api.pids.clearPidFile();
            self.api.log("The actionHero has been stopped", "bold");
            self.api.log("***");
            if(typeof next == "function"){ next(null, self.api); }
        };

        async.series(orderedTeardowns);
    }else{
        self.api.log("Cannot shut down (not running any servers)");
        if(typeof next == "function"){ next(null, self.api); }
    }
};

actionHero.prototype.restart = function(next){
    var self = this;

    if(self.api.running === true){
        self.stop(function(err){
            self.start(self.startingParams, function(err, api){
                api.log('actionHero restarted', "green");
                if(typeof next == "function"){ next(null, self.api); }
            });
        });
    }else{
        self.start(self.startingParams, function(err, api){
            api.log('actionHero restarted', "green");
            if(typeof next == "function"){ next(null, self.api); }
        });
    }
};

exports.actionHeroPrototype = actionHero;