#!/usr/bin/env bash

set +e #abort if any command fails

GIT_REPO="git@github.com:evantahler/actionhero.git"
GIT_BRANCH="gh-pages"
BUILD_DIR="/tmp/actionhero-site"
SOURE_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

echo "---------------------"
echo "GIT_REPO:   $GIT_REPO"
echo "GIT_BRANCH: $GIT_BRANCH"
echo "BUILD_DIR:  $BUILD_DIR"
echo "SOURE_DIR:  $SOURE_DIR"
echo "---------------------"

# Start from scracth

rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR
git clone $GIT_REPO $BUILD_DIR
cd $BUILD_DIR && git checkout $GIT_BRANCH

# Build the site
cd $SOURE_DIR && bundle exec middleman build --no-clean

# Push it
cd $BUILD_DIR
git add .
git commit -am "Publish $GIT_BRANCH @ `date`"
set +e # now we don't care about errors
git push

echo "---------------------"
echo 'Done!'
