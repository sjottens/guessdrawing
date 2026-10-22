# Build from the repository root:
#   docker build -f apps/server/Dockerfile -t krabbel-server .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm install --frozen-lockfile --filter @guessdrawing/server...
RUN pnpm --filter @guessdrawing/server build \
 && pnpm --filter @guessdrawing/server deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
