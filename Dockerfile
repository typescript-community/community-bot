# Two stage build to avoid installing dev dependencies in deployed image
FROM node:24.14.1-alpine AS build
WORKDIR /usr/src/app

COPY yarn.lock ./
COPY package.json ./

RUN yarn

COPY . .

RUN yarn build

FROM node:24.14.1-alpine AS prod
WORKDIR /usr/src/app

COPY yarn.lock ./
COPY package.json ./

RUN yarn --production

COPY --from=build /usr/src/app/dist dist

CMD [ "node", "dist/index.js" ]
