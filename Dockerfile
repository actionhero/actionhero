FROM alpine:3.5
MAINTAINER admin@actionherojs.com

WORKDIR /actionhero

RUN apk add --update nodejs git
RUN git clone https://github.com/actionhero/actionhero.git /actionhero
RUN npm install

CMD ["node", "./bin/actionhero", "start"]
EXPOSE 8080 5000
