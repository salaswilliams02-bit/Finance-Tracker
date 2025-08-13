# Personal Finance Dashboard (Vite + React + Tailwind)

A simple local-only dashboard to track transactions, goals, and spending analytics.

## Quick start

```bash
# 1) Install Node.js 18+
# 2) In this folder:
npm install
npm run dev
```

Then open the printed local URL in your browser.

## Features
- Add transactions (date, description, amount, category)
- CSV import/export (headers: date,description,amount,category)
- Category breakdown & monthly trends (Recharts)
- Goals & progress bars
- Filters by month and category
- Data saved in browser localStorage (no server)

## Build for production
```bash
npm run build
npm run preview
```
