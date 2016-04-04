# Actionhero Site + Docs / www.actionherojs.com

## Do not publish to the `gh-pages` branch directly.  Make any changes in a PR to master.

This folder contains the build files for www.actionherojs.com (which are served by github-pages)

We use [Middleman](https://middlemanapp.com/) to build and compile this site, and host it for free on [Github Pages](http://pages.github.com/). Pages can be written in markdown or HTML, and Middleman will build the site.

There are two main parts of the site (and consequently 2 main layouts): `home` and `docs`.

You will need ruby installed locally and the `github-pages` gem

## Run the site locally:

- install ruby
- install bundler: `gem install bundler`
- use bundler to install the needed gems `bundle install`
- run the middleman servers locally `npm run site` (`cd site && EXECJS_RUNTIME=Node bundle exec middleman`)
  - on OSX there are a ton of problems installing some of these gems.  This might not be the fix you need, but here are some hints: http://stackoverflow.com/questions/19630154/gem-install-therubyracer-v-0-10-2-on-osx-mavericks-not-installing/20145328
    - `brew install homebrew/dupes/apple-gcc42`
    - `brew uninstall v8`
    - `gem uninstall libv8 therubyracer`
    - `export  CC=/usr/local/Cellar/apple-gcc42/4.2.1-5666.3/bin/gcc-4.2`
    - `export CXX=/usr/local/Cellar/apple-gcc42/4.2.1-5666.3/bin/g++-4.2`
    - `export CPP=/usr/local/Cellar/apple-gcc42/4.2.1-5666.3/bin/cpp-4.2`
    - `bundle install`


## Deploy the code

Open a pull request to the `master` branch with your changes in the `site` folder.  

From there, we'll build the `gh-pages` branch out of master (see `deploy.sh` in this directory), and deploy the site.  GitHub pages will automatically build the site for us upon push.  This is also triggered via `npm postpublish` => `npm run build-gh-pages` which will ensure that on every release of this package, the documenation site is up to date!

## Thanks

- The theme for the home section of the site comes from: http://startbootstrap.com/grayscale
- The theme for the docs section of the site comes from: https://github.com/tripit/slate
