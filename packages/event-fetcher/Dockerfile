# Build from packages/:
# docker build -f event-fetcher/Dockerfile packages
FROM oven/bun:1-alpine
WORKDIR /app
COPY danmaku ./danmaku
COPY event-fetcher ./event-fetcher
RUN cd event-fetcher && bun install
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "event-fetcher/src/cli.ts"]
