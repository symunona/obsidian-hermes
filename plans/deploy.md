Create a new deploy script, pnpm dev should copy the 3 build files:

manifest.json
main.js
style.css

into the target folder's .obsidian/plugins/plugin-hermes folder.

Use the env variables TARGET_DEV and TARGET_PROD to determine which target folder to copy to!

`pnpm deploy prod` should copy to TARGET_PROD <- only this one!
`pnpm deploy dev` should copy to TARGET_DEV

if var do not exists, let the user know when deploy is running. Create deploy.sh

`pnpm dev` should auto copy to TARGET_DEV, if var exists
`pnpm build` should copy to TARGET_DEV too.

if var do not exists, let the user know, but just ignore for now.

If folder exists, show ALERT.

