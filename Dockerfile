FROM node:latest AS build-stage

WORKDIR /app

COPY package.json .

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM node:latest

COPY --from=build-stage /app/dist /app/dist
COPY --from=build-stage /app/package.json /app/package.json
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install --production
EXPOSE 3000

CMD ["sh", "-c", "NODE_ENV=production node ./dist/main.js"]
