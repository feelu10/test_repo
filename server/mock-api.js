import cors from 'cors';
import express from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const databasePath = join(__dirname, 'bookings.json');
const app = express();
const port = process.env.MOCK_API_PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function readBookings() {
  if (!existsSync(databasePath)) return [];
  try {
    return JSON.parse(readFileSync(databasePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  writeFileSync(databasePath, JSON.stringify(bookings, null, 2));
}

function validateBooking(body) {
  const errors = [];

  if (!body?.pickup?.date) errors.push('pickup.date is required');
  if (!body?.pickup?.time) errors.push('pickup.time is required');
  if (!body?.pickup?.address) errors.push('pickup.address is required');
  if (!body?.dropoff?.address) errors.push('dropoff.address is required');
  if (!body?.customer?.phone) errors.push('customer.phone is required');
  if (!body?.customer?.firstName) errors.push('customer.firstName is required');
  if (!body?.customer?.lastName) errors.push('customer.lastName is required');
  if (!body?.customer?.email) errors.push('customer.email is required');
  if (!Number.isInteger(body?.passengers) || body.passengers < 1) {
    errors.push('passengers must be a positive integer');
  }

  return errors;
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'ExampleIQ mock booking API' });
});

app.get('/api/bookings', (_request, response) => {
  response.json({ data: readBookings() });
});

app.post('/api/bookings', (request, response) => {
  const errors = validateBooking(request.body);

  if (errors.length > 0) {
    return response.status(422).json({ message: 'Validation failed', errors });
  }

  const bookings = readBookings();
  const booking = {
    bookingId: `BK-${Date.now()}`,
    ...request.body,
    savedAt: new Date().toISOString(),
  };

  bookings.unshift(booking);
  writeBookings(bookings);

  return response.status(201).json({
    message: 'Booking saved to mock API.',
    bookingId: booking.bookingId,
    data: booking,
  });
});

app.listen(port, () => {
  console.log(`Mock API running at http://localhost:${port}`);
});
