FROM caddy:alpine

COPY dist/ /etc/caddy/html/
COPY deploy/caddy/Caddyfile /etc/caddy/

EXPOSE 80
