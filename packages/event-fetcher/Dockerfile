# Build from the frontend repository root:
# docker build -f packages/event-fetcher/Dockerfile .
FROM oven/bun:1-alpine
WORKDIR /app
COPY packages/danmaku ./packages/danmaku
COPY packages/event-fetcher ./packages/event-fetcher
RUN cd packages/event-fetcher && bun install
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "packages/event-fetcher/src/cli.ts"]
