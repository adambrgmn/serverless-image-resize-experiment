# The base image resembles the Lambda runtime as closely as possible
FROM lambci/lambda:build-nodejs8.10
RUN npm install -g yarn

# The STAGE environment variable can be overridden by defining it before deploy
# Example: `STAGE=production yarn run deploy`
ENV STAGE development

# We copy package.json and yarn.lock before any other files in order to leverage
# Dockers caching before running `yarn install`
COPY package.json yarn.lock ./
RUN yarn install --force

# All files are blindly copied over (except those defined inside .dockerignore)
COPY . .

# Lastly we build out the dist files
RUN yarn run build
