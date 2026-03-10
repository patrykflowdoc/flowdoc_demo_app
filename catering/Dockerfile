FROM node:24-alpine

WORKDIR /app

RUN npm install -g npm@latest

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]