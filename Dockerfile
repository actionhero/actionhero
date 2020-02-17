FROM alpine:latest
MAINTAINER admin@actionherojs.com

WORKDIR /actionhero

COPY package*.json ./
RUN apk add --update nodejs nodejs-npm git
COPY . .
RUN npm install
RUN npm run prepare

# CMD ["node", "./node_modules/.bin/actionhero", "start"] This is what you would use in your project
CMD ["node", "./dist/server.js"]
EXPOSE 8080 5000
