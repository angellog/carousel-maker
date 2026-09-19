# syntax=docker/dockerfile:1
#
# Carousel Maker — production image.
#
# All image rendering, PNG export and download happen in the user's browser, so
# the server ships no native canvas library and stays tiny. This is a standard
# multi-stage Next.js "standalone" build: install, build, then run only the
# traced output as a non-root user.

# ---- deps: install exactly what package-lock pins -------------------------
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: produce .next/standalone --------------------------------------
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run: minimal runtime with only the standalone server -----------------
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4321 \
    HOSTNAME=0.0.0.0
# The standalone output is self-contained; copy its three pieces.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Run as the built-in unprivileged user.
USER node
EXPOSE 4321
CMD ["node", "server.js"]
