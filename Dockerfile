FROM node:16

# Installeer FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
