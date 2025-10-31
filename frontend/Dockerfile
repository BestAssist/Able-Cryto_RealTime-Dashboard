# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_WS_URL
ARG VITE_API_ORIGIN
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
COPY package*.json ./
RUN npm install
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# ---- Nginx Runtime ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
