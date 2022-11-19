FROM node:16.18.1-alpine
WORKDIR /usr/src/app

COPY yarn.lock ./
COPY package.json ./

RUN yarn

COPY . .

RUN yarn build

CMD [ "node", "dist/index.js" ]
