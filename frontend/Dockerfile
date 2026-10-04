# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Desenvolvimento: servidor Vite com hot reload ---------------------------
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Build de produção --------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# --- Produção: Caddy serve o build e faz proxy reverso para o backend -----------
FROM caddy:2-alpine AS prod
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
