FROM alpine:latest
MAINTAINER admin@actionherojs.com

ENV PORT=8080

WORKDIR /actionhero

COPY package*.json ./
RUN apk add --update nodejs nodejs-npm git
COPY . .
RUN npm install
RUN npm run prepare

CMD ["node", "./dist/server.js"]
EXPOSE $PORT
