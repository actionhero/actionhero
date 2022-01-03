#!/usr/bin/env bash

echo "--- CONFIURING CODESPACE ---"

# configure node
nvm install v16
npm install

# configure redis
sudo apt-get install redis-tools -y
docker run -p 6379:6379 --name redis -d redis
