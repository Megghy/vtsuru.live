FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

FROM caddy:alpine
COPY --from=build /app/dist/ /etc/caddy/html/
COPY deploy/caddy/Caddyfile /etc/caddy/

EXPOSE 80
