FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -U pip yt-dlp

ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
