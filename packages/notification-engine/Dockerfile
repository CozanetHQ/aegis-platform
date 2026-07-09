FROM node:20-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install
COPY . .
RUN npm run build || true
EXPOSE 3000
CMD ["npm", "run", "dev"]
