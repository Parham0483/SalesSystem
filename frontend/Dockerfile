# Build stage
FROM node:18 as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all environment files
COPY .env* ./

# Copy source code
COPY . .

# Set NODE_ENV and force production API URL
ENV NODE_ENV=production
ENV REACT_APP_API_URL=/api/
ENV REACT_APP_GOOGLE_CLIENT_ID=775814213572-h7009vmkdj87gpuko2puh3n22oesfnj5.apps.googleusercontent.com

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]