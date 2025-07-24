FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["echo", "Override this CMD in docker-compose.yml"]