# Actionhero Docs / www.actionherojs.com

This folder contains the build files for www.actionherojs.com (which are served by github-pages)

We use [Jekyll](http://jekyllrb.com/) to build and compile this site, and host it for free on [Github Pages](http://pages.github.com/).  Pages can be written in markdown or HTML, and Jekyll will build the site. 

There are two main parts of the site (and consequently 2 main layouts): `docs` and `site`.

You will need ruby installed locally and the `github-pages` gem

## Run the blog locally:

- install ruby
- install bundler: `gem install bundler`
- use bundler to install the needed gems `bundle install`
- run jekyll in server mode `bundle exec jekyll serve --watch`

## Deploy the code

Open a pull requset to the `master` branch with your changes in the `docs` folder.  From there, we'll build the `gh-pages` branch out of master, and deploy the site.