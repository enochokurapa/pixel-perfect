# syntax=docker/dockerfile:1

# Use the glibc-based Node image for dependency installation/building.
# The previous Alpine/Bun builder intermittently failed while extracting
# @cloudflare/workerd-linux-64 on Coolify.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# The browser has safe public Supabase fallbacks in source, so the build does
# not require Supabase secrets or build-time ARG values.
COPY package.json ./
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
