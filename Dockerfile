# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci

# Pass build environment arguments
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_DATABASE_URL
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID
ARG FIREBASE_FIRESTORE_DATABASE_ID="(default)"
ARG VITE_APP_ENV="DEV"
ARG VITE_GIT_BRANCH="dev"

# Set environment variables for build
ENV FIREBASE_API_KEY=$FIREBASE_API_KEY \
    FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN \
    FIREBASE_DATABASE_URL=$FIREBASE_DATABASE_URL \
    FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID \
    FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET \
    FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID \
    FIREBASE_APP_ID=$FIREBASE_APP_ID \
    FIREBASE_FIRESTORE_DATABASE_ID=$FIREBASE_FIRESTORE_DATABASE_ID \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_GIT_BRANCH=$VITE_GIT_BRANCH

# Copy application source code
COPY . .

# Build Vite SPA production bundle
RUN npm run build

# Stage 2: Serve static bundle via Nginx
FROM nginx:alpine AS runner

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose default Cloud Run port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
