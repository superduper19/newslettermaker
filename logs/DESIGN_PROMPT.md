# Design Style Guide for Newsletter Maker App

## Overall Style
Clean, editorial, light mode. Think Notion or Medium's editor — white space, clear typography, subtle borders. This is a content/publishing tool, not a data dashboard. It should feel calm and professional to work in for an hour each week.

## Backgrounds
- Main background: `#ffffff` (white)
- Section dividers / alternating table rows: `#f8f9fa` (barely gray)
- Cards and panels: white with a thin `#e5e7eb` border
- No dark mode. No heavy colored backgrounds.

## Typography
- Primary text: `#111827` (near black)
- Secondary / hint text: `#6b7280` (medium gray)
- Clean sans-serif font (Inter, system font, or similar)

## Accent Color
- Primary accent for buttons, active tabs, links: `#7c3aed` (purple)
- Hover states: slightly darker shade of accent

## Category Color System
Each article category gets a colored pill/badge — soft pastel background with darker text of the same hue:
- **MED**: background `#dcfce7`, text `#16a34a` (green)
- **THC**: background `#f3e8ff`, text `#7c3aed` (purple)
- **CBD**: background `#dbeafe`, text `#2563eb` (blue)
- **INV**: background `#fef3c7`, text `#d97706` (amber/gold)

Use these as small rounded pills wherever a category appears in tables or cards.

## Status Indicators
Article statuses shown as small colored dots next to the status text:
- **Y** (Yes): solid green dot `#16a34a`
- **YM** (Yes Maybe): yellow/orange dot `#d97706`
- **M** (Maybe): gray dot `#9ca3af`
- **N** (No): no dot, just dimmed text
- **COOL FINDS**: teal dot `#14b8a6` or a small star icon

## Navigation
The top nav bar (Article Search → Article View → Image View → Inspirational Images → Text → Confirmation) should be a horizontal stepped progress bar:
- Completed steps: checkmark + accent color
- Active step: bold/highlighted with accent color
- Future steps: gray text
- Include a "Next" button on each page to advance

## Tables (Article View, Image View)
- Light header row with bold white text on a muted dark background (`#1e293b`)
- Alternating row backgrounds: white and `#f8f9fa`
- Thin horizontal dividers between rows: `#e5e7eb`
- Category columns (MED, THC, CBD, INV) show the colored pill if that article belongs to the category
- Generous row height so article titles and links breathe

## Image Selection Area
- Selected image: larger (roughly 85x85), with a subtle border or shadow to show it is chosen
- Other image options: smaller thumbnails (55x55) in a horizontal row
- Arrow on the right for "more options"
- White background makes the colorful icons pop on their own

## Text Editor Page
- Four text areas (MED, THC, CBD, INV) in a 2x2 grid
- Each labeled with its category pill at the top
- Valediction field below each text area
- Light borders around text areas, no heavy styling

## Confirmation Page
- Newsletter previews shown as cards in a 2x2 grid
- Each card has a category pill label and a "Download" button
- Clean white card with thin border and subtle shadow

## General Rules
- Minimal use of bold. Only for headings and article titles.
- No emojis in the UI (emojis are only in the newsletter content itself).
- Rounded corners on pills, buttons, and cards (border-radius: 6-8px).
- Generous padding and white space everywhere.
- Buttons: solid accent color with white text for primary actions, outlined/ghost style for secondary actions.
