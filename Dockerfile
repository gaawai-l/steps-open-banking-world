FROM node:22-alpine
WORKDIR /srv/app
COPY package.json server.js /srv/app/
COPY src /srv/app/src
COPY public /srv/app/public
# Deliberately broken: this package does not exist and the build has no network anyway.
RUN npm install -g does-not-exist-package-xyz
ENV PORT=8080
CMD ["node", "server.js"]
