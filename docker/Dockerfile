# Build the sandbox against the runtime's libc; Debian's 0.8 lacks required argv0 support.
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS confinement
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential meson ninja-build pkg-config libcap-dev curl ca-certificates xz-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN curl --fail --location --silent --show-error \
      https://github.com/containers/bubblewrap/releases/download/v0.11.1/bubblewrap-0.11.1.tar.xz \
      --output bubblewrap.tar.xz \
    && echo 'c1b7455a1283b1295879a46d5f001dfd088c0bb0f238abb5e128b3583a246f71  bubblewrap.tar.xz' | sha256sum --check \
    && tar -xf bubblewrap.tar.xz \
    && meson setup output bubblewrap-0.11.1 --buildtype=release -Dtests=false -Dman=disabled -Dselinux=disabled \
    && meson compile -C output

# Build the supervisor separately from the projects it will manage.
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS build
WORKDIR /opt/arcnexus
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json tsconfig.fixtures.json ./
COPY scripts/foundation/build.ts ./scripts/foundation/build.ts
COPY src ./src
COPY fixtures ./fixtures
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
RUN apt-get update \
    && apt-get install -y --no-install-recommends git libcap2 util-linux tini curl openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global @openai/codex@0.166.0-alpha.6
WORKDIR /opt/arcnexus
COPY --from=confinement --chmod=755 /build/output/bwrap /usr/local/bin/bwrap
COPY --from=build /opt/arcnexus/dist ./dist
COPY --from=build /opt/arcnexus/node_modules ./node_modules
COPY --from=build /opt/arcnexus/package.json /opt/arcnexus/package-lock.json ./
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/arcnexus-entrypoint
RUN ln -s /opt/arcnexus/dist/cli.js /usr/local/bin/arcnexus
ENV HOME=/home/node ARCNEXUS_VOLUME=/var/lib/arcnexus
ENTRYPOINT ["/usr/local/bin/arcnexus-entrypoint"]
CMD ["node", "dist/library/execution-runtime/container-main.js"]
