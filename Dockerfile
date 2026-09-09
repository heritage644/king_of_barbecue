FROM node:20-alpine

WORKDIR /app

# Copy package manifests first
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/core/package.json ./packages/core/package.json

# Install all monorepo dependencies
RUN npm ci

# Copy project source
COPY . .

EXPOSE 3000 4000