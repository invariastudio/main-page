# Invaria Studio public site

Static publisher, privacy, and support site for Invaria Studio and Saldara.

The production site is intended for GitHub Pages at:

- `https://invariastudio.github.io/main-page/`
- `https://invariastudio.github.io/main-page/saldara/privacy/`
- `https://invariastudio.github.io/main-page/saldara/support/`

## Local review

Run `npm run check` to validate internal links, required public disclosures,
and the absence of forms and common tracking scripts. Any static HTTP server
can serve the repository root for local visual review.

## Publishing

In GitHub, open **Settings > Pages**, select **Deploy from a branch**, choose
the `main` branch and `/ (root)`, then save.

## Public-repository boundary

This repository contains only public static site files and fictional Saldara
screenshots. It must not contain application source code, signing material,
purchase-verifier secrets, private planning documents, personal financial
records, analytics, or customer support messages.

Unless a file states otherwise, the site copy, visual design, screenshots, and
brand assets are Copyright 2026 Invaria Studio. All rights reserved. No
open-source license or trademark permission is granted by publication of this
repository.
