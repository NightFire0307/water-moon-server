FROM node:20

WORKDIR /app

COPY package.json .

RUN npm config set registry https://registry.npmmirror.com/

RUN npm i

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "./dist/main.js"]
