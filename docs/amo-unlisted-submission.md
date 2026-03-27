# AMO Unlisted Submission

## Artifacts

- Local test XPI: `npm run build:xpi`
- Unlisted signing submission: `npm run sign:unlisted`
- Source review archive: `npm run build:source-review`

Outputs are written to `dist/`.

## Reviewer Notes

Suggested text for AMO reviewer notes:

> This add-on exports ChatGPT conversations from `https://chatgpt.com/*` to local Markdown files.
>
> It is a user-triggered Firefox extension for personal export only. It does not send conversation data to any developer-controlled server, does not include analytics, and does not inject or execute remote code.
>
> Main behavior:
> - Runs only on `https://chatgpt.com/*`.
> - Triggered only when the user clicks the browser action button.
> - Reads the current ChatGPT conversation from page state when available.
> - If page state is insufficient, it may request the current conversation from ChatGPT's own same-site web-session endpoint only to read the conversation already visible to the signed-in user.
> - Converts conversation content to Markdown locally in the browser and downloads a `.md` file to the user's machine.
> - Stores only user configuration in `browser.storage.local` (export templates and active profile).
> - Does not transmit exported data anywhere except the user's local browser download flow.
>
> Permissions:
> - `storage`: save export profile settings.
>
> Network behavior:
> - No requests are made to developer-controlled servers.
> - No use of the paid OpenAI developer API.
> - Any conversation fetch is limited to ChatGPT's own web origin and only uses the user's existing authenticated session in the browser.
>
> Bundled third-party libraries:
> - Turndown: `lib/turndown.js` from https://github.com/mixmark-io/turndown
> - turndown-plugin-gfm: `lib/turndown-plugin-gfm.js` from https://github.com/mixmark-io/turndown-plugin-gfm
> - JSONata: `lib/jsonata.js` from https://github.com/jsonata-js/jsonata
> - Yuppee: `lib/yuppee.js` from https://github.com/simonwep/yuppee
>
> Files of interest for review:
> - `manifest.json`
> - `background.js`
> - `extension.js`
> - `options.js`
> - `settings-update.js`
> - `storage-migrations.js`

## Submission Checklist

- Verify `manifest.json` version and Gecko ID are correct.
- Ensure `scripts/.env.json` contains your AMO JWT key and secret locally.
- Run `npm test`.
- Run `npm run build:xpi`.
- Run `npm run build:source-review`.
- If ready to submit for signing, run `npm run sign:unlisted`.
- Upload the generated source review archive if AMO requests source for review.
- In reviewer notes, explain that the extension uses the user's existing ChatGPT web session and does not connect to any separate developer service.

## Notes

- `scripts/.env.json` is intentionally ignored by git. Use `scripts/.env.example.json` as the template.
- `npm run sign:unlisted` signs from the staged extension files in `dist/_xpi_staging`, not from the whole repository tree.
