# Actionhero Site + Docs / www.actionherojs.com

This folder contains the build files for www.actionherojs.com (which are served by github-pages)

We use [Jekyll](https://jekyllrb.com) to build and compile this site, and host it for free on [Github Pages](http://pages.github.com/). Pages can be written in markdown or HTML, and GitHub will build the site automatically off of the master branch.

You will need ruby installed locally and the `github-pages` gem.

## Run the site locally:

- install ruby
- install bundler: `gem install bundler`
- use bundler to install the needed gems `bundle install`
- run the middleman servers locally `bundle exec jekyll serve --watch`

## Deploy the code

Open a pull request to the `master` branch with your changes in the `site` folder.  GitHub Pages handles the rest
