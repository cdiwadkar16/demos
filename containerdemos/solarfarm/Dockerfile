# Use the official Node.js image
FROM node:slim

# Set the working directory
WORKDIR /app

#copy package.json and package-lock.json
COPY package*.json .

#copy tsconfig.json

COPY t*.json .

#copy other application code
COPY *.ts .

# Install dependencies
RUN npm install

#Install ts-node
RUN npm install -g ts-node

# Command to run the Node.js app
CMD ["ts-node", "sfportfolio.ts", "local"]
