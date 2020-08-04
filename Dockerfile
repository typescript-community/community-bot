FROM node:14.7.0-alpine
WORKDIR /usr/src/app

COPY yarn.lock ./
COPY package.json ./

RUN yarn

COPY . .

CMD [ "yarn", "start" ]
