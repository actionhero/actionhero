---
layout: docs
title: Documentation - Production Notes
---

# Production Notes
A collection of thoughts on deploying actionhero apps

## Topology Example

Here is a common actionhero production topology:

![cluster](/img/cluster.png)

Notes:

- It's best to seperate the "worekrs" from the web "servers"
   - be sure to modify the config files for each type of server acordingly (ie: turn of all servers for the workers, and turn of all workers on the servers)
- Always have a replica of redis!

## Paths and Environments

You can set a few environment variables to affect how actionhero runs:

- `PROJECT_ROOT`: This is useful when deploying actionhero applications on a server where symlinks will change under a running process.  The cluster will look at your symlink `PROJECT_ROOT=/path/to/current_symlink` rather than the absolute path it was started from
- `ACTIONHERO_ROOT`: This can used to set the absolute path to the actionhero binaries
- `ACTIONHERO_CONFIG`: This can be user to set the absolute path to the actionhero config directory you wish to use.  This is useful when you might have a variable configs per server
- `ACTIONHERO_TITLE`: The value of `api.id`, and the name for the pidfile in some boot configurations

## Daemon

When deploying actionhero, you will probably have more than 1 process.  You can use the cluster manager to keep an eye on the workers and manage them

- Start the cluster with 2 workers: `./node_modules/.bin/actionhero startCluster --workers=2`

When deploying new code, you can gracefully restart your workers by sending the `USR2` signal to the cluster manager to signal a reload to all workers.  You don't need to start and stop the cluster-master.  This allows for 0-downtime deployments.  

You may want to set some of the ENV variables above to help with your deployment.

## Number of workers

When choosing the number of workers (`--workers=n`) for your actionhero cluster, choose at least 1 less than the number of CPUs available.  If you have a "burstable" architecture (like a Joyent smart machine), opt for the highest number of 'consistent' CPUs you can have, meaning a number of CPUs that you will always have available to you.  

You never want more workers than you can run at a time, or else you will actually be slowing down the execution of all processes.

Of course, not going in to swap memory is more important than utilizing all of your CPUs, so if you find yourself running out of ram, reduce the number of workers! 

## Pidfiles

actionhero will write its pid to a pidfile in the normal unix way.  The path for the pidfile is set in `config/api.js` with `config.general.paths.pid`.  

Individual actionhero servers will name their pidfiles by `api.id`, which is determined by the logic [here](https://github.com/evantahler/actionhero/blob/master/initializers/pids.js) and [here](https://github.com/evantahler/actionhero/blob/master/initializers/id.js).  For example, on my laptop with the IP address of `192.168.0.1`, running `npm start` would run one actionhero server and generate a pidfile of `./pids/actionhero-192.168.0.1` in which would be a single line containg the process' pid.

When running the cluster, the cluster process first writes his own pidfile to `process.cwd() + './pids/cluster_pidfile'`.  Then, every worker the cluster master creates will have a pid like `actionhero-worker-1` in the location defined by `config/api.js`.

## Git-based deployment Example

To send a signal to the cluster master process to reboot all its workers (`USR2`), you can cat the pidfile (bash):
{% highlight bash %}
kill -s USR2 `cat /path/to/pids/cluster_pidfile`
{% endhighlight %}

If you want to setup a git-based deployment, the simplest steps would be something like:

{% highlight javascript %}
#!/usr/bin/env bash
# assuming the actionhero cluster master process is already running

DEPLOY_PATH=/path/to/your/application

cd $DEPLOY_PATH && git pull
cd $DEPLOY_PATH && npm install
# run any grunt tasks here, like perhaps an asset compile step or a database migration
cd $DEPLOY_PATH && kill -s USR2 `cat pids/cluster_pidfile`
{% endhighlight %}

## Global Packages

It's probably best to avoid installing any global packages.  This way, you won't have to worry about conflicts, and your project can be kept up to date more easily.  When using npm to install a local package the package's binaries are always copied into `./node_modules/.bin`. 

You can add local references to your $PATH like so to use these local binaries:

`export PATH=$PATH:node_modules/.bin`

## Nginx Example

While actionhero can be the font-line server your users hit, it's probably best to proxy actionhero behind a load balancer, nginx, haproxy, etc.  This will help you pool connections before hitting node, SSL terminate, serve static assets, etc.  

Here is an example nginx config for interfacing with actionhero, including using sockets (not http) and handing the websocket upgrade path.

- Note the proxy-pass format to the socket: proxy_pass http://unix:/path/to/socket
- Note some of the extra work you need to have for the websocket upgrade headers (the primus directive)


From `config/servers/web.js`

{% highlight javascript %}
exports.production = { 
  servers: {
    web: function(api){
      return {
        port: '/home/USER/www/APP/current/tmp/sockets/actionhero.sock',
        bindIP: null,
        metadataOptions: {
          serverInformation: false,
          requesterInformation: false
        }
      }
    }
  }
}
{% endhighlight %}

The nginx.conf:

{% highlight bash %}
#user  nobody;
worker_processes  4;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;


events {
  worker_connections 1024;
  accept_mutex on;
}


http {
    include       mime.types;
    default_type  application/octet-stream;
    server_tokens off;
    sendfile        on;
    keepalive_timeout  65;

    set_real_ip_from  X.X.X.X/24;
    real_ip_header    X-Forwarded-For;

    gzip on;
    gzip_http_version 1.0;
    gzip_comp_level 9;
    gzip_proxied any;
    gzip_types text/plain text/xml text/css text/comma-separated-values text/javascript application/x-javascript font/ttf font/otf image/svg+xml application/atom+xml;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for" $request_time';

    server {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        proxy_set_header X_FORWARDED_PROTO https;
        proxy_redirect off;

        listen       80;
        server_name  _;

        access_log  /var/log/nginx/access.log  main;
        error_log   /var/log/nginx/error.log;

        root        /home/XXUSERXX/XXAPPLICATIONXX/www/current/public/;
        try_files /$uri/index.html /cache/$uri/index.html /$uri.html /cache/$uri.html /$uri /cache/$uri @app;

        client_max_body_size 50M;

        location /primus {
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;

            proxy_pass http://unix:/home/XXUSERXX/www/XXAPPLICATIONXX/shared/tmp/sockets/actionhero.sock;
        }

        location / {
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_cache_bypass $http_pragma $http_authorization;
            proxy_no_cache $http_pragma $http_authorization;

            proxy_pass http://unix:/home/XXUSERXX/www/XXAPPLICATIONXX/shared/tmp/sockets/actionhero.sock;
        }
    }

}
{% endhighlight %}

## Security

Be sure to change `api.config.general.serverToken` to something unique for your application
