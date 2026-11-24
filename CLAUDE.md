# reelwright

The Reelwright Claude Code plugin: the skill is in `skills/reelwright/`, the brand kit in `brand/`.

## Rules

- Every pull request that changes what the plugin does adds its lines to `CHANGELOG.md` under
  **Unreleased** (Added, Changed, Fixed or Removed), written for someone using the plugin, with the PR number.
- A release moves the Unreleased lines under `## [x.y.z] - YYYY-MM-DD`, updates the compare links at the
  bottom, and bumps `version` in `.claude-plugin/plugin.json` and the version badge in `README.md`, or
  installed copies keep the old one.
- The README's images are in `.github/readme/`. When the promo reel is re-rendered or a scene type is added,
  remake `hero.webp`, `cuts-*.webp` and `scenes-*.webp` so the README shows what the plugin makes now.
- `brand/` is not MIT: keep its LICENSE and TRADEMARKS.md, and say so wherever the licence comes up.
- Commit as `mtblck <105079242+mtblck@users.noreply.github.com>`.
