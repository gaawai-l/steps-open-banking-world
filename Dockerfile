# No RUN step and no third-party dependencies: the platform builds this image with the
# network disabled, so everything must come from the base image or this repository.
FROM node:22-alpine

WORKDIR /srv/app
COPY package.json server.js /srv/app/
COPY src /srv/app/src
COPY public /srv/app/public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
