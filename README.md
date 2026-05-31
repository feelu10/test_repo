# ExampleIQ Booking Form Skills Test

A responsive booking form recreation based on the provided screenshot. It includes input validation, Google Maps Places autocomplete, Google Maps Distance Matrix distance/travel-time calculation, phone-number recognition, local customer saving, and submission to a mock API endpoint.

## Features

- Layout closely matches the provided ExampleIQ booking form screenshot
- Responsive desktop and mobile design
- One-way / hourly trip switcher
- Pickup and drop off location sections
- Optional stop field
- Client-side validation with inline errors
- Google Places autocomplete for pickup/drop off addresses
- Google Distance Matrix API for distance and travel time
- Phone-number recognition using localStorage
  - New number: asks for first name, last name, and email
  - Existing number: greets customer by first name
- Mock API endpoint with Express
- Saves submitted bookings to `server/bookings.json`

## Tech Stack

- React
- Vite
- CSS
- Express mock API
- Google Maps JavaScript API / Places / Distance Matrix

## Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and add your Google Maps API key:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
VITE_MOCK_API_URL=http://localhost:4000/api/bookings
```

In Google Cloud, enable these APIs for the key:

- Maps JavaScript API
- Places API
- Distance Matrix API

## Run Locally

```bash
npm run dev
```

The app will run on Vite, usually:

```text
http://localhost:5173
```

The mock API will run at:

```text
http://localhost:4000/api/bookings
```

## Mock API Endpoints

### Health check

```http
GET http://localhost:4000/api/health
```

### List saved bookings

```http
GET http://localhost:4000/api/bookings
```

### Create booking

```http
POST http://localhost:4000/api/bookings
Content-Type: application/json
```

## Phone Recognition Demo

A demo customer is seeded in localStorage:

```text
+1 555 123 4567
```

Use that phone number to see the welcome-back message.

For any new number, the form asks for first name, last name, and email. After successful submit, the number is saved locally. If the same number is entered again, the form greets the customer by first name.

## Google Maps Demo Mode

If no Google Maps API key is provided, the form still works in demo mode using preset coordinates for the sample addresses in the screenshot. For the real test submission, add a real Google Maps API key in `.env`.

## Build

```bash
npm run build
npm run preview
```

## Recording Checklist

1. Show the project folder and code editor.
2. Run `npm run dev`.
3. Open the form in the browser.
4. Show responsive layout by resizing the browser.
5. Type a new phone number and show first name, last name, and email fields.
6. Submit the form and show the success message.
7. Enter the same phone number again and show the welcome-back greeting.
8. Open `server/bookings.json` to show the mock API saved the booking.
