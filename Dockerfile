FROM caddy:alpine

COPY dist/ /etc/caddy/html/
COPY src/files/Caddyfile /etc/caddy/

EXPOSE 80