FROM alpine:3.3
MAINTAINER admin@actionherojs.com

RUN apk add --update nodejs
RUN npm install actionhero
RUN ./node_modules/.bin/actionhero generate
RUN npm install

CMD ["node", "./node_modules/.bin/actionhero", "start"]
EXPOSE 8080 5000
