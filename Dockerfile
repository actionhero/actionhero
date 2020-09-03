FROM node:alpine
LABEL maintainer="admin@actionherojs.com"

ENV PORT=8080

WORKDIR /actionhero

COPY package*.json ./
COPY . .
RUN npm install
RUN npm run prepare

CMD ["node", "./dist/server.js"]
EXPOSE $PORT
