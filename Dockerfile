FROM node:20-alpine AS builder

WORKDIR /app

# Copy yarn workspace config files
COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN yarn install --frozen-lockfile

# Copy everything else
COPY . .

# Generate Prisma Client
RUN yarn workspace api prisma generate

# Build shared package
RUN yarn workspace shared build

# Build API
RUN yarn workspace api build

# ---

FROM node:20-alpine AS runner

WORKDIR /app

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# We also need the prisma folder for migrations or generated client
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# By default, Render injects the DATABASE_URL and other env vars.
# Start the API directly.
CMD ["node", "apps/api/dist/main.js"]
