ARG ARC_PLATFORM_IMAGE=arcnexus-platform-review
ARG ARC_POSTGRES_IMAGE=postgres:18.7-trixie
FROM ${ARC_PLATFORM_IMAGE} AS platform
FROM ${ARC_POSTGRES_IMAGE}
WORKDIR /app
COPY --from=platform /usr/local/bin/node /usr/local/bin/node
COPY --from=platform /app/package.json ./
COPY --from=platform /app/node_modules ./node_modules
COPY --from=platform /app/dist ./dist
ENTRYPOINT ["/usr/local/bin/node", "/app/dist/apps/db/src/cli.js"]
CMD []
