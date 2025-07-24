# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install


# Copy the rest of the backend code
COPY . .


EXPOSE 7000

# Start the server
CMD ["npm", "run", "dev"]