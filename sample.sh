#!/bin/bash

# I am used to generate a "client" application using this master branch of actionhero.
# Use me for testing things like the generator

CURRENT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEFAULT_DESTINATION="$HOME/Desktop/actionhero_tmp"
DESTINATION=${1:-$DEFAULT_DESTINATION}

echo "Creating a sample actionhero app @ $DESTINATION from $CURRENT_PATH"

rm -rf $DESTINATION
sleep 1
mkdir $DESTINATION
# cd $DESTINATION && mkdir 'node_modules'
# cd $DESTINATION/node_modules && mkdir '.bin'
# cd $DESTINATION/node_modules && ln -s $CURRENT_PATH actionhero
# cd $DESTINATION/node_modules/.bin && ln -s ../actionhero/bin/actionhero actionhero 
cd $DESTINATION && npm install actionhero

cd $DESTINATION && node_modules/.bin/actionhero generate
cd $DESTINATION && npm install

echo ""
echo "***************"
echo "cd $DESTINATION"