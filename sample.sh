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
cd $DESTINATION && npm install actionhero
cd $DESTINATION && npx actionhero generate
cd $DESTINATION && npm install

echo ""
echo "***************"
echo "cd $DESTINATION"

cd $DESTINATION
