FROM alpine:3.3
MAINTAINER evan@evantahler.com

RUN apk add --update nodejs

ADD package.json package.json
RUN npm install
ADD . .

CMD ["node", "./bin/actionhero"]
EXPOSE 8080 5000
