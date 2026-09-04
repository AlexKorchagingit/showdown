# SHOWDOWN — Poker in Bryansk

Telegram Mini App (TMA) for a premium poker club. Built with React + Vite + TypeScript.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8** — build tool
- **Tailwind CSS 3** — utility-first styling (black-gold premium theme)
- **React Router DOM 7** — client-side routing
- **Lucide React** — icons
- **@twa-dev/sdk** — Telegram Web App SDK

## Features

- **Bottom Tab Bar** with 4 sections: Home, Tournaments, Rating, Profile
- **Tournaments list** with "Current" / "Past" tab switcher
- **Tournament detail** page with:
  - Hero image placeholder
  - Seats progress bar (live state)
  - Guarantee badge
  - Full tournament description and rules
  - Sticky "Register / Cancel" CTA button
- Safe-area aware layout (iOS notch / home indicator support)
- Fully mobile-first, no horizontal scroll

## Project Structure

```
src/
├── components/
│   ├── BottomNav.tsx        # Fixed bottom navigation
│   ├── ProgressBar.tsx      # Seats fill progress bar
│   └── TournamentCard.tsx   # Tournament list card
├── context/
│   └── TournamentContext.tsx # Global tournament state
├── data/
│   └── tournaments.ts       # Mock tournament data
├── pages/
│   ├── HomePage.tsx
│   ├── TournamentsPage.tsx
│   ├── TournamentDetailPage.tsx
│   ├── RatingPage.tsx
│   └── ProfilePage.tsx
└── types/
    └── tournament.ts        # TypeScript interfaces
```

## Development

```bash
npm install
cp .env.example .env.local   # fill VITE_SUPABASE_ANON_KEY
npm run dev
```

Frontend talks to `https://api.showdown-br.ru`. Static files are served from the domain root (`/logo-final.webp`, `/avatars/…`), not `/showdown/`.

New accounts always receive the `user` role. Existing `is_admin` profiles are preserved as
`admin` during the role migration; `superadmin` is assigned only through an explicit,
reviewed database operation and is never selected automatically by email or registration order.

## Build

```bash
npm run build
```
