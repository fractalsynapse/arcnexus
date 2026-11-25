# ArcNexus web frame

From the repository root, run `npm run build` and then `npm run web`.
Open the loopback URL printed by the server. To reuse a local port, pass it
with `npm run web -- <port>`.

Review the header and pinned workspace navigation, named site schemes,
responsive command panel, and round metrics dialog. The page gear opens
layout settings, where workspaces use one shared editor for registered
panels, desktop columns, placement and mobile display order. The frame reports
commands and metrics as unavailable until workspace integration.

## Local platform review

Set `ARC_WEB_API_ORIGIN` to the API URL and `ARC_WEB_OPERATOR_TOKEN_FILE` to
the existing operator secret file. The loopback Web proxy supplies this
credential to the API. Open the local URL in any browser to use the
Project manager and Connection manager. The API and MCP keep their
programmatic operator authentication.

The root platform Compose configuration publishes the Web port on
loopback and sets `ARC_WEB_BROWSER_ORIGIN` to that published origin. Use
this local review configuration on a private machine. External OAuth
will handle shared user sign-in when the application is ready for it.

The browser entry composes the UI plugin with separate workspace, command
binding, and React frame plugins in `src/plugins`.

For browser acceptance, install Chromium with
`npx --no-install playwright install chromium` and run
`npm test -- web-app`. The same suite can use an existing Chromium binary
through `ARC_CHROMIUM_PATH`. It exercises the built local entry and uses
the same composition with a controlled binding for command interaction.

## Platform setup design preview

From the repository root, run `npm run build`, then run
`node dist/apps/web/previews/platform/serve.js 38647`. Open
[the local preview](http://127.0.0.1:38647/plan/). The computer and folder
icons open Connection manager and Project manager in the shared frame.
Start with [sample providers](http://127.0.0.1:38647/plan/?providers=sample)
to exercise admission and revocation.

The preview represents registration and project entries with local fixture
state. ArcNexus is the initial project. Additional URLs can be entered and
selected for design review. Live reachability, registration and published
launcher binaries depend on the platform implementation.

## Local Compose stack

Run these commands from the repository root with Docker Compose and OpenSSL.

```sh
cd apps/web
mkdir -p .docker
if [ ! -f .docker/postgres-password ]; then
  (umask 077 && openssl rand -hex 32 > .docker/postgres-password)
fi
docker compose up --build --wait
```

Open [http://127.0.0.1:38646/plan/](http://127.0.0.1:38646/plan/).
Set `ARC_WEB_PORT` when invoking Compose to use a different host port.
The web container runs the same built shell as the native preview. The
PostgreSQL service runs independently on a private network with a named data
volume. ArcNexus continues to use SQLite for coordination until the storage
migration. Use `docker compose exec postgres psql -U arcnexus -d arcnexus`
to inspect the new database. From this directory, `docker compose down`
stops the stack and retains the named volume.
