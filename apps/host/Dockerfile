ARG ARC_PLATFORM_IMAGE=arcnexus-platform-review
FROM ${ARC_PLATFORM_IMAGE} AS bubblewrap
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev libcap-dev libselinux1-dev meson ninja-build pkg-config xz-utils \
    && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:0e85c8702248b8dd64144f594147553650cdd0e4c951690345faace79c217c4d \
    https://github.com/containers/bubblewrap/releases/download/v0.13.1/bubblewrap-0.13.1.tar.xz /tmp/bubblewrap.tar.xz
RUN mkdir /tmp/bubblewrap \
    && tar -xJf /tmp/bubblewrap.tar.xz -C /tmp/bubblewrap --strip-components=1 \
    && meson setup /tmp/bubblewrap/build /tmp/bubblewrap -Dtests=false -Dman=disabled -Dbash_completion=disabled -Dselinux=enabled \
    && meson compile -C /tmp/bubblewrap/build bwrap

FROM ${ARC_PLATFORM_IMAGE}
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gh git libcap2 libselinux1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/local/bin/node /usr/local/bin/npm /usr/bin/
COPY --from=bubblewrap --chmod=0755 /tmp/bubblewrap/build/bwrap /usr/bin/bwrap
ARG ARC_CODEX_VERSION
RUN test -n "${ARC_CODEX_VERSION}" && npm install --global "@openai/codex@${ARC_CODEX_VERSION}"
LABEL io.arcnexus.worker="host"
USER node
ENTRYPOINT ["node", "/app/dist/apps/host/src/main.js"]
CMD []
