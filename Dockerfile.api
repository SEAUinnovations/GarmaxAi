FROM node:20-bullseye-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --registry=https://registry.npmjs.org/
RUN npm install ts-node typescript --save-dev

COPY . .

EXPOSE 3000

CMD ["npx", "ts-node", "src/index.ts"]