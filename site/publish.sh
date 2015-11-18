#!/bin/bash

# I will build the site and publish it to gh-pages
# Inspired by https://github.com/edgecase/middleman-gh-pages

# note the starting directory
STARTING_DIR=`pwd`

# Ensure we are in the right place
cd "$(dirname "$0")"

# Ensure that we have all the gems we need installed
bundle install

# Move into the build direcotry
mkdir -p ./build
cd ./build

# In the build directory; clone the repo and force it to the gh-pages branch
if [ -d .git ] ; then
  git fetch origin
  git reset --hard origin/gh-pages
else
  git init
  git remote add origin git@github.com:evantahler/actionhero.git
  git fetch origin
  # git checkout --orphan gh-pages
  git checkout gh-pages # assume the remote directory already exists
fi

# Do a full rebuild of the site
bundle exec middleman build --clean

# make an arbitray commit and push it up!
touch index.html
git add .
git commit -m "site build on $(date) by $(whoami)"
git push origin gh-pages
