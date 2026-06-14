FROM node:24-bookworm-slim

# Install Python3 + required system libs for opencv/numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install YOLOv8 and vision packages
# break-system-packages is required on Debian 12+ (bookworm)
RUN pip3 install --break-system-packages --no-cache-dir \
    ultralytics \
    opencv-python-headless \
    Pillow \
    numpy

WORKDIR /app

# Install pnpm at the exact version the lock file was created with
RUN npm install -g pnpm@10.26.1

# Copy workspace config files (separate layer for cache efficiency)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.json tsconfig.base.json ./

# Copy all workspace packages
COPY lib/ lib/
COPY artifacts/ artifacts/
COPY scripts/ scripts/

# Install Node.js dependencies
RUN pnpm install --frozen-lockfile

# Build frontend (Vite) and API server (esbuild)
RUN NODE_ENV=production pnpm --filter @workspace/tkdl run build && \
    pnpm --filter @workspace/api-server run build

# WORKDIR stays at /app so:
#   process.cwd() = /app
#   artifacts/tkdl/dist/public resolves correctly (via FRONTEND_DIST or cwd)
#   DART_SCORER_DIR env var points to /app/artifacts/dart-scorer

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
