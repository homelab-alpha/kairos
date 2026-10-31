# Kairos brand guide

## Name and meaning

**Kairos** (Greek: καιρός) means the right, opportune moment. The Greeks had two
words for time: _chronos_ is the clock that keeps ticking, and _kairos_ is the
moment that is just right. In this project, chronos is the 96 quarter-hour price
slots of a day, and kairos is the cheapest slot, the moment to charge.

Always write the name as **Kairos** in Latin letters. The Greek word may be used
as a small accent, for example in the README.

## Slogan

> Charge at the right moment.

## Logo

The mark is a price line with quarter-hour steps and one highlighted dip. The
dot marks the cheapest moment. It is flat, uses round line caps, and has a
single accent color.

| File                     | Use                                    |
| ------------------------ | -------------------------------------- |
| `icon_light.svg`         | App icon, avatar (light tile)          |
| `icon_dark.svg`          | App icon, avatar (dark tile)           |
| `mark_light.svg`         | Mark on light backgrounds              |
| `mark_dark.svg`          | Mark on dark backgrounds               |
| `logo_light.svg`         | Mark and wordmark on light backgrounds |
| `logo_dark.svg`          | Mark and wordmark on dark backgrounds  |
| `logo_tagline_light.svg` | Logo with slogan on light backgrounds  |
| `logo_tagline_dark.svg`  | Logo with slogan on dark backgrounds   |
| `favicon.svg`            | Favicon, simplified, follows the theme |
| `social_preview.png`     | GitHub social preview, 1280×640 px     |
| `social_preview.svg`     | Source of the social preview           |

All wordmark and slogan text is converted to outlines, so the files look the
same on every system.

## Colors

The palette follows the Apple system colors for iOS.

| Name   | Light     | Dark      | Use                        |
| ------ | --------- | --------- | -------------------------- |
| Accent | `#30B0C7` | `#40CBE0` | The dot, links, highlights |
| Ink    | `#1D1D1F` | `#F5F5F7` | Line, wordmark, text       |
| Paper  | `#F5F5F7` | n/a       | Light tile and background  |
| Night  | n/a       | `#1C1C1E` | Dark tile and background   |
| Muted  | `#6E6E73` | `#98989D` | Slogan and secondary text  |

Use the accent color sparingly: one accent per view, always the cheapest moment.

## Relation to the card

The brand colors are for brand assets only: the logo, the icon, the README, and
social images. The card itself keeps its semantic tokens in `KAIROS_TOK` and the
heat scale in `KAIROS_HEAT`, which follow `docs/design_guidelines.md`. Never use
a brand color as a raw color in the card.

## Typography

- **Wordmark:** Inter SemiBold (600), tight tracking, drawn as outlines.
- **Slogan:** Inter Medium (500).
- **Interface and documents:** SF Pro on Apple devices, with `system-ui` as the
  fallback.

## Clear space and minimum size

- Keep clear space around the logo equal to the height of the dip dot.
- `logo_light.svg` and `logo_dark.svg` include a 20 px protective border on
  every side, so the README can show them at a fixed height of 100 px. Keep this
  border and height in every repository.
- Minimum width: 96 px for the logo, 16 px for the favicon, 24 px for the mark.
- Below 24 px, use `favicon.svg` (four steps instead of six).

## Do and don't

- Do use the light files on light backgrounds and the dark files on dark ones.
- Do keep the dot in the accent color.
- Don't stretch, rotate, or recolor the mark.
- Don't add shadows, gradients, or outlines.
- Don't use more than one accent color.
- Don't write the name in Greek letters only; always include Kairos.
