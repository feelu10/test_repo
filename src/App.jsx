import { useEffect, useMemo, useRef, useState } from 'react';

const CUSTOMERS_KEY = 'exampleiq_saved_customers';
const MAPS_SCRIPT_ID = 'google-maps-js-sdk';

const seedCustomers = {
  '+15551234567': {
    firstName: 'Mia',
    lastName: 'Sample',
    email: 'mia@example.com',
    phone: '+15551234567',
  },
};

const demoCoordinates = {
  'Clintons Bar & Grille, High Street, Clinton, MA, USA': {
    lat: 42.4168,
    lng: -71.6829,
  },
  'Logan Airport Terminal B, Boston, MA, USA': {
    lat: 42.3656,
    lng: -71.0096,
  },
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function loadCustomers() {
  try {
    const existing = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '{}');
    const merged = { ...seedCustomers, ...existing };
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(seedCustomers));
    return seedCustomers;
  }
}

function saveCustomer(customer) {
  const normalized = normalizePhone(customer.phone);
  if (!normalized) return;
  const current = loadCustomers();
  current[normalized] = { ...customer, phone: normalized };
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(current));
}

function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPS_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMiles(a, b) {
  const earthMiles = 3958.8;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthMiles * Math.asin(Math.sqrt(x));
}

function formatPhoneForDisplay(phone) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export default function App() {
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const stopInputRef = useRef(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsNotice, setMapsNotice] = useState('Google Maps loading...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  const [knownCustomer, setKnownCustomer] = useState(null);
  const [hasStop, setHasStop] = useState(false);

  const [form, setForm] = useState({
    tripType: 'one_way',
    pickupMode: 'location',
    dropoffMode: 'location',
    pickupDate: '2023-05-13',
    pickupTime: '15:00',
    pickupAddress: 'Clintons Bar & Grille, High Street, Clinton, MA, USA',
    pickupPlaceId: '',
    pickupCoords: demoCoordinates['Clintons Bar & Grille, High Street, Clinton, MA, USA'],
    stopAddress: '',
    stopPlaceId: '',
    stopCoords: null,
    dropoffAddress: 'Logan Airport Terminal B, Boston, MA, USA',
    dropoffPlaceId: '',
    dropoffCoords: demoCoordinates['Logan Airport Terminal B, Boston, MA, USA'],
    phone: '+1 774 415 3244',
    firstName: '',
    lastName: '',
    email: '',
    passengers: '',
  });

  const [routeInfo, setRouteInfo] = useState({
    status: 'idle',
    distanceText: '',
    durationText: '',
    provider: '',
  });

  const apiUrl = import.meta.env.VITE_MOCK_API_URL || 'http://localhost:4000/api/bookings';
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const normalizedPhone = useMemo(() => normalizePhone(form.phone), [form.phone]);
  const contactRequired = Boolean(normalizedPhone && !knownCustomer);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setSuccess(null);
  }

  function applyPlace(fieldPrefix, place) {
    const address = place.formatted_address || place.name || '';
    const coords = place.geometry?.location
      ? {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }
      : null;

    setForm((current) => ({
      ...current,
      [`${fieldPrefix}Address`]: address,
      [`${fieldPrefix}PlaceId`]: place.place_id || '',
      [`${fieldPrefix}Coords`]: coords,
    }));
  }

  useEffect(() => {
    let mounted = true;

    loadGoogleMaps(googleMapsApiKey)
      .then((ready) => {
        if (!mounted) return;
        setMapsReady(ready);
        setMapsNotice(
          ready
            ? 'Google Maps API connected.'
            : 'Demo mode: add VITE_GOOGLE_MAPS_API_KEY to enable real Google Maps distance and travel time.'
        );
      })
      .catch(() => {
        if (!mounted) return;
        setMapsReady(false);
        setMapsNotice('Google Maps failed to load. Demo distance estimate is active.');
      });

    return () => {
      mounted = false;
    };
  }, [googleMapsApiKey]);

  useEffect(() => {
    if (!mapsReady || !window.google?.maps?.places) return;

    const options = {
      fields: ['formatted_address', 'geometry', 'name', 'place_id'],
      types: ['geocode', 'establishment'],
    };

    const pickupAutocomplete = new window.google.maps.places.Autocomplete(
      pickupInputRef.current,
      options
    );
    const dropoffAutocomplete = new window.google.maps.places.Autocomplete(
      dropoffInputRef.current,
      options
    );

    pickupAutocomplete.addListener('place_changed', () => {
      applyPlace('pickup', pickupAutocomplete.getPlace());
    });

    dropoffAutocomplete.addListener('place_changed', () => {
      applyPlace('dropoff', dropoffAutocomplete.getPlace());
    });

    let stopAutocomplete = null;
    if (stopInputRef.current) {
      stopAutocomplete = new window.google.maps.places.Autocomplete(stopInputRef.current, options);
      stopAutocomplete.addListener('place_changed', () => {
        applyPlace('stop', stopAutocomplete.getPlace());
      });
    }
  }, [mapsReady, hasStop]);

  useEffect(() => {
    const customers = loadCustomers();
    setKnownCustomer(customers[normalizedPhone] || null);
  }, [normalizedPhone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      calculateRoute();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [form.pickupAddress, form.dropoffAddress, form.pickupCoords, form.dropoffCoords, hasStop, form.stopAddress, form.stopCoords, mapsReady]);

  function validate() {
    const nextErrors = {};

    if (!form.pickupDate) nextErrors.pickupDate = 'Pickup date is required.';
    if (!form.pickupTime) nextErrors.pickupTime = 'Pickup time is required.';
    if (!form.pickupAddress.trim()) nextErrors.pickupAddress = 'Pickup location is required.';
    if (!form.dropoffAddress.trim()) nextErrors.dropoffAddress = 'Drop off location is required.';
    if (hasStop && !form.stopAddress.trim()) nextErrors.stopAddress = 'Stop location is required.';
    if (!normalizedPhone || normalizedPhone.length < 8) nextErrors.phone = 'Enter a valid phone number.';

    if (contactRequired) {
      if (!form.firstName.trim()) nextErrors.firstName = 'First name is required for new phone numbers.';
      if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required for new phone numbers.';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    }

    const passengerCount = Number(form.passengers);
    if (!Number.isInteger(passengerCount) || passengerCount < 1) {
      nextErrors.passengers = 'Enter at least 1 passenger.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function getRoutePoints() {
    const points = [];

    points.push({
      address: form.pickupAddress,
      coords: form.pickupCoords || demoCoordinates[form.pickupAddress],
    });

    if (hasStop) {
      points.push({
        address: form.stopAddress,
        coords: form.stopCoords || demoCoordinates[form.stopAddress],
      });
    }

    points.push({
      address: form.dropoffAddress,
      coords: form.dropoffCoords || demoCoordinates[form.dropoffAddress],
    });

    return points;
  }

  function calculateRoute() {
    if (!form.pickupAddress.trim() || !form.dropoffAddress.trim()) {
      setRouteInfo({ status: 'idle', distanceText: '', durationText: '', provider: '' });
      return;
    }

    const points = getRoutePoints();
    const hasBlankStop = hasStop && !form.stopAddress.trim();
    if (hasBlankStop) return;

    if (mapsReady && window.google?.maps?.DistanceMatrixService) {
      const service = new window.google.maps.DistanceMatrixService();
      const origin = points[0].coords || points[0].address;
      const destination = points[points.length - 1].coords || points[points.length - 1].address;

      setRouteInfo((current) => ({ ...current, status: 'loading' }));

      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.IMPERIAL,
          avoidHighways: false,
          avoidTolls: false,
        },
        (response, status) => {
          const element = response?.rows?.[0]?.elements?.[0];
          if (status === 'OK' && element?.status === 'OK') {
            setRouteInfo({
              status: 'ready',
              distanceText: element.distance.text,
              durationText: element.duration.text,
              provider: 'Google Maps',
            });
          } else {
            setRouteInfo({
              status: 'error',
              distanceText: '',
              durationText: '',
              provider: 'Google Maps',
            });
          }
        }
      );

      return;
    }

    const coordsAvailable = points.every((point) => point.coords);
    if (!coordsAvailable) {
      setRouteInfo({
        status: 'error',
        distanceText: '',
        durationText: '',
        provider: 'Demo estimate',
      });
      return;
    }

    let miles = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      miles += haversineMiles(points[index].coords, points[index + 1].coords);
    }

    const drivingMiles = miles * 1.18;
    const minutes = Math.max(1, Math.round((drivingMiles / 42) * 60));

    setRouteInfo({
      status: 'ready',
      distanceText: `${drivingMiles.toFixed(1)} mi`,
      durationText: `${minutes} min`,
      provider: 'Demo estimate',
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSuccess(null);

    if (!validate()) return;

    setIsSubmitting(true);

    const customer = knownCustomer || {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: normalizedPhone,
    };

    const payload = {
      tripType: form.tripType,
      pickup: {
        mode: form.pickupMode,
        date: form.pickupDate,
        time: form.pickupTime,
        address: form.pickupAddress.trim(),
        placeId: form.pickupPlaceId,
        coords: form.pickupCoords,
      },
      stops: hasStop
        ? [
            {
              address: form.stopAddress.trim(),
              placeId: form.stopPlaceId,
              coords: form.stopCoords,
            },
          ]
        : [],
      dropoff: {
        mode: form.dropoffMode,
        address: form.dropoffAddress.trim(),
        placeId: form.dropoffPlaceId,
        coords: form.dropoffCoords,
      },
      customer,
      passengers: Number(form.passengers),
      route: routeInfo.status === 'ready' ? routeInfo : null,
      submittedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Mock API request failed.');
      }

      const result = await response.json();
      saveCustomer(customer);
      setKnownCustomer(customer);
      setSuccess({
        id: result.bookingId,
        message: `Booking submitted successfully for ${customer.firstName}.`,
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: 'Could not submit to the mock API. Make sure npm run dev is running.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="booking-card" aria-label="Booking form">
        <header className="brand-header">
          <div className="brand-mark" aria-hidden="true">
            <span className="speedometer">◠</span>
          </div>
          <span className="brand-name">ExampleIQ</span>
        </header>

        <h1>Let's get you on your way!</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="segmented-control" role="tablist" aria-label="Trip type">
            <button
              type="button"
              className={form.tripType === 'one_way' ? 'active' : ''}
              onClick={() => updateField('tripType', 'one_way')}
            >
              <span className="pill-icon">●</span>
              One-way
            </button>
            <button
              type="button"
              className={form.tripType === 'hourly' ? 'active' : ''}
              onClick={() => updateField('tripType', 'hourly')}
            >
              <span className="pill-icon hourglass">⌛</span>
              Hourly
            </button>
          </div>

          <section className="form-section">
            <h2>Pickup</h2>
            <div className="two-column fields-tight">
              <FieldWrapper icon="📅" error={errors.pickupDate}>
                <input
                  aria-label="Pickup date"
                  type="date"
                  value={form.pickupDate}
                  onChange={(event) => updateField('pickupDate', event.target.value)}
                />
              </FieldWrapper>

              <FieldWrapper icon="🕒" error={errors.pickupTime}>
                <input
                  aria-label="Pickup time"
                  type="time"
                  value={form.pickupTime}
                  onChange={(event) => updateField('pickupTime', event.target.value)}
                />
              </FieldWrapper>
            </div>

            <ModeToggle
              value={form.pickupMode}
              onChange={(value) => updateField('pickupMode', value)}
            />

            <AddressInput
              refObject={pickupInputRef}
              label="Location"
              placeholder="Pickup location"
              value={form.pickupAddress}
              error={errors.pickupAddress}
              onChange={(value) => {
                updateField('pickupAddress', value);
                updateField('pickupCoords', demoCoordinates[value] || null);
              }}
            />

            {hasStop ? (
              <div className="stop-block">
                <AddressInput
                  refObject={stopInputRef}
                  label="Stop"
                  placeholder="Add stop address"
                  value={form.stopAddress}
                  error={errors.stopAddress}
                  onChange={(value) => {
                    updateField('stopAddress', value);
                    updateField('stopCoords', demoCoordinates[value] || null);
                  }}
                />
                <button type="button" className="link-button remove" onClick={() => setHasStop(false)}>
                  Remove stop
                </button>
              </div>
            ) : (
              <button type="button" className="link-button" onClick={() => setHasStop(true)}>
                + Add a stop
              </button>
            )}
          </section>

          <section className="form-section dropoff-section">
            <h2>Drop off</h2>
            <ModeToggle
              value={form.dropoffMode}
              onChange={(value) => updateField('dropoffMode', value)}
            />

            <AddressInput
              refObject={dropoffInputRef}
              label="Location"
              placeholder="Drop off location"
              value={form.dropoffAddress}
              error={errors.dropoffAddress}
              onChange={(value) => {
                updateField('dropoffAddress', value);
                updateField('dropoffCoords', demoCoordinates[value] || null);
              }}
            />
          </section>

          <RouteSummary routeInfo={routeInfo} mapsNotice={mapsNotice} />

          <section className="form-section contact-section">
            <h2>Contact Information</h2>

            <FieldWrapper icon={<span className="flag">🇺🇸</span>} error={errors.phone}>
              <input
                aria-label="Phone number"
                type="tel"
                value={form.phone}
                placeholder="+1 774 415 3244"
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </FieldWrapper>

            {knownCustomer ? (
              <p className="customer-message success-message">
                Welcome back, <strong>{knownCustomer.firstName}</strong>. We found your phone number on file.
              </p>
            ) : (
              <p className="customer-message">
                We don't have that phone number on file. Please provide additional contact information.
              </p>
            )}

            {contactRequired && (
              <div className="contact-extra">
                <div className="two-column">
                  <FieldWrapper icon="👤" label="First name" error={errors.firstName}>
                    <input
                      type="text"
                      value={form.firstName}
                      placeholder="First name"
                      onChange={(event) => updateField('firstName', event.target.value)}
                    />
                  </FieldWrapper>

                  <FieldWrapper icon="👤" label="Last name" error={errors.lastName}>
                    <input
                      type="text"
                      value={form.lastName}
                      placeholder="Last name"
                      onChange={(event) => updateField('lastName', event.target.value)}
                    />
                  </FieldWrapper>
                </div>

                <FieldWrapper icon="@" label="Email" error={errors.email}>
                  <input
                    type="email"
                    value={form.email}
                    placeholder="name@example.com"
                    onChange={(event) => updateField('email', event.target.value)}
                  />
                </FieldWrapper>
              </div>
            )}
          </section>

          <section className="form-section passenger-section">
            <label className="question-label" htmlFor="passengers">
              How many passengers are expected for the trip?
            </label>
            <FieldWrapper label="# Passengers" error={errors.passengers} compact>
              <input
                id="passengers"
                type="number"
                min="1"
                inputMode="numeric"
                value={form.passengers}
                placeholder="#"
                onChange={(event) => updateField('passengers', event.target.value)}
              />
            </FieldWrapper>
          </section>

          {success && (
            <div className="alert success-alert" role="status">
              <strong>{success.message}</strong>
              <span>Mock booking ID: {success.id}</span>
            </div>
          )}

          {errors.submit && (
            <div className="alert error-alert" role="alert">
              {errors.submit}
            </div>
          )}

          <button type="submit" className="continue-button" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

function FieldWrapper({ children, icon, label, error, compact = false }) {
  return (
    <div className={`field-group ${compact ? 'compact' : ''}`}>
      {label && <span className="floating-label">{label}</span>}
      <div className={`input-shell ${error ? 'has-error' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        {children}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function ModeToggle({ value, onChange }) {
  return (
    <div className="mode-tabs" role="group" aria-label="Location type">
      <button
        type="button"
        className={value === 'location' ? 'active' : ''}
        onClick={() => onChange('location')}
      >
        Location
      </button>
      <button
        type="button"
        className={value === 'airport' ? 'active' : ''}
        onClick={() => onChange('airport')}
      >
        Airport
      </button>
    </div>
  );
}

function AddressInput({ refObject, label, placeholder, value, onChange, error }) {
  return (
    <div className="address-block">
      <FieldWrapper icon="📍" label={label} error={error}>
        <input
          ref={refObject}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
        <span className="dropdown-caret">▾</span>
      </FieldWrapper>
    </div>
  );
}

function RouteSummary({ routeInfo, mapsNotice }) {
  return (
    <section className="route-summary" aria-label="Route summary">
      <div>
        <span className="route-label">Distance + travel time</span>
        <strong>
          {routeInfo.status === 'loading'
            ? 'Calculating...'
            : routeInfo.status === 'ready'
              ? `${routeInfo.distanceText} • ${routeInfo.durationText}`
              : 'Enter valid pickup and drop off locations'}
        </strong>
      </div>
      <p>
        {routeInfo.provider ? `${routeInfo.provider}. ` : ''}
        {mapsNotice}
      </p>
    </section>
  );
}
