import { useEffect, useRef } from 'react';

// Lightweight typed alias for the Google Places SDK we only touch here.
// We keep this file self-contained so no `@types/googlemaps` install is
// needed — the surface we use is tiny.
declare global {
  interface Window {
    google?: any;
    __googlePlacesLoading?: Promise<void>;
  }
}

/**
 * Load the Google Maps JS SDK (Places library) once and cache the promise
 * so any subsequent component mounts reuse the same script tag. Rejects
 * if the network fails; callers should treat rejection as "fall back to
 * a plain input" — the autocomplete is a nice-to-have, not required.
 */
function loadGooglePlacesSDK(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__googlePlacesLoading) return window.__googlePlacesLoading;
  window.__googlePlacesLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Places'));
    document.head.appendChild(script);
  });
  return window.__googlePlacesLoading;
}

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postcode: string;
}

function parseComponents(components: any[]): ParsedAddress {
  const get = (
    type: string,
    key: 'long_name' | 'short_name' = 'long_name',
  ): string => {
    const c = components.find((c: any) => c.types?.includes(type));
    return c ? c[key] : '';
  };
  const subpremise = get('subpremise');
  const streetNumber = get('street_number');
  const route = get('route');
  const numberPart = [subpremise, streetNumber].filter(Boolean).join('/');
  const street = [numberPart, route].filter(Boolean).join(' ').trim();
  const city =
    get('locality') || get('sublocality_level_1') || get('sublocality');
  const state = get('administrative_area_level_1', 'short_name');
  const postcode = get('postal_code');
  return { street, city, state, postcode };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parts: ParsedAddress) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Address autocomplete widget backed by Google Places, restricted to
 * Australian addresses. When the user picks a suggestion, onSelect is
 * called with the parsed street / city / state / postcode so the
 * containing form can populate the sibling fields in one go.
 *
 * Falls back to a plain text input when VITE_GOOGLE_PLACES_API_KEY is
 * missing or the SDK fails to load — the field never breaks.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  className,
  placeholder,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  // Vite's import.meta.env is untyped in this project (no vite-env.d.ts).
  // The cast keeps this component self-contained without adding a global
  // types file.
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY as
    | string
    | undefined;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    loadGooglePlacesSDK(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) {
          return;
        }
        const ac = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            componentRestrictions: { country: 'au' },
            types: ['address'],
            fields: ['address_components'],
          },
        );
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (!place?.address_components) return;
          const parts = parseComponents(place.address_components);
          onSelect(parts);
          if (parts.street) onChange(parts.street);
        });
        autocompleteRef.current = ac;
      })
      .catch(() => {
        // Silent fallback — input becomes a plain text field.
      });
    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(
          autocompleteRef.current,
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <input
      ref={inputRef}
      type="text"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
