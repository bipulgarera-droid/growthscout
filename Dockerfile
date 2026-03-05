# ---- Build Stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install all deps (including devDeps for build)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build the Vite frontend
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim

# Install Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server source (tsx runs TypeScript directly)
COPY server/ ./server/
COPY tsconfig.json ./

# Install tsx for running TypeScript in production
RUN npm install tsx

EXPOSE ${PORT:-5001}

CMD ["node", "--import", "tsx", "server/index.ts"]
