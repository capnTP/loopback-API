# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:8

# install chrom depnedency for puppetier
# See https://crbug.com/795759
RUN apt-get update && apt-get install -yq libgconf-2-4

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update && apt-get install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst ttf-freefont \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge --auto-remove -y curl \
    && rm -rf /src/*.deb

# Create base directory
RUN mkdir -p /src/app

# Specify the "working directory" for the rest of the Dockerfile
WORKDIR /src/app

COPY ./package.json /src/app/package.json
# COPY ./package-lock.json /src/app/package-lock.json
RUN npm install --silent

# Copy sourcecode
COPY . /src/app

EXPOSE 3003
CMD [ "npm", "start" ]

