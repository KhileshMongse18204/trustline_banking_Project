# Global Phone Number Validation Website

A clean frontend + backend website for APILayer Number Verification.

## Features

- Validate international phone numbers
- Show all important fields:
  - valid
  - number
  - international_format
  - local_format
  - country_code
  - country_name
  - country_prefix
  - location
  - carrier
  - line_type
- Fetch supported countries from APILayer `/countries`
- Keep API key secure on the backend using `.env`
- Fallback country sample if live countries request fails
- Polished responsive UI

## Project Structure

```bash
phone-verification-site/
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .env.example
├── package.json
├── README.md
└── server.js
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root:

```env
APILAYER_API_KEY=your_real_apilayer_key
PORT=3001
```

3. Start the project:

```bash
npm start
```

4. Open:

```bash
http://localhost:3001
```

## API Endpoints used

- `GET /api/countries` → backend proxy to APILayer `/countries`
- `GET /api/validate?number=...` → backend proxy to APILayer `/validate`

## Important

Do not put the APILayer key directly in frontend JavaScript. Keep it only in `.env`.
