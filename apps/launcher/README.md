# Isolated launcher downloads

Build the repository, create a local artifact directory, then run
`node dist/apps/launcher/src/build.js <artifact-directory> linux-x64` or
`node dist/apps/launcher/src/build.js <artifact-directory> linux-arm64`
from the repository root with Bun on the path. Each build stages the binary
and its SHA-256 checksum together. Use a new artifact directory for a new
deployment.

Mount the artifact directory read-only into the isolated API service and
point `ARC_LAUNCHER_ARTIFACTS` at that container path. The Connection manager
lists the Linux architectures and enables downloads for staged builds.
`GET /launcher-builds` advertises the available targets and checksums.

Builds for this release require a Linux host with Docker. Use the
[Host setup](../host/README.md) to configure and register the launcher.
