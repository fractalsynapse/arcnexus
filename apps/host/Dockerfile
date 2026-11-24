ARG ARC_PLATFORM_IMAGE=arcnexus-platform-review
FROM ${ARC_PLATFORM_IMAGE}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap ca-certificates gh git     && rm -rf /var/lib/apt/lists/*
ARG ARC_CODEX_VERSION
RUN test -n "${ARC_CODEX_VERSION}" && npm install --global "@openai/codex@${ARC_CODEX_VERSION}"
LABEL io.arcnexus.worker="host"
USER node
ENTRYPOINT ["node", "/app/dist/apps/host/src/main.js"]
CMD []
