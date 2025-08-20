# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S caro -u 1001

# Copy package files
COPY --chown=caro:nodejs package.json yarn.lock ./

# Production dependencies stage
FROM base AS deps
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Development dependencies stage (for build if needed)
FROM base AS deps-dev
RUN yarn install --frozen-lockfile

# Build stage (if we had build steps)
FROM deps-dev AS build
COPY --chown=caro:nodejs . .
# RUN yarn build (uncomment if build step is needed)

# Production stage
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=deps --chown=caro:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=caro:nodejs . .

# Remove development files
RUN rm -rf .git .gitignore .dockerignore docker-compose.yml README.md yarn.lock

# Switch to non-root user
USER caro

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
