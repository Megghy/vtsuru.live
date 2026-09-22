# Build from packages/:
# docker build -f event-fetcher/Dockerfile packages
FROM oven/bun:1-alpine
WORKDIR /app
COPY danmaku ./danmaku
COPY event-fetcher ./event-fetcher
# typescript 7 只是 @laplace.live/ws 的 dev/peer 依赖，带上会多出一份 30MB 的编译器
RUN cd event-fetcher && bun install --omit=dev --omit=peer && rm -rf /root/.bun
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "event-fetcher/src/cli.ts"]
