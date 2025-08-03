# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy all environment files
COPY .env* ./

# Copy source code
COPY . .

# Set NODE_ENV and force production API URL
ENV NODE_ENV=production
ENV REACT_APP_API_URL=/api/
ENV REACT_APP_GOOGLE_CLIENT_ID=775814213572-h7009vmkdj87gpuko2puh3n22oesfnj5.apps.googleusercontent.com

# Debug: Show environment variables during build
RUN echo "🔍 Build environment:" && \
    echo "NODE_ENV: $NODE_ENV" && \
    echo "REACT_APP_API_URL: $REACT_APP_API_URL" && \
    echo "REACT_APP_GOOGLE_CLIENT_ID: $REACT_APP_GOOGLE_CLIENT_ID"

# Build the app
RUN npm run build

# Verify the build used correct API URL
RUN echo "🔍 Checking built files for API URLs..." && \
    find build/static/js -name "*.js" -exec grep -l "127.0.0.1:8000" {} \; || echo "✅ No localhost:8000 found in build"

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
