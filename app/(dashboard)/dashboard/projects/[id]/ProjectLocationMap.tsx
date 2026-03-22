// Server Component — no 'use client' needed.
// Renders a map embed (Google Maps Embed API) or a styled placeholder.
//
// Requires: NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env.local
// If the key is absent, falls back to a clean address card with
// a working "Open in Google Maps" link.

interface ProjectLocationMapProps {
  address: string | null
}

export function ProjectLocationMap({ address }: ProjectLocationMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''
  const mapsOpenUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null
  const embedSrc = apiKey && address
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}&zoom=15`
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[#1C3FAA]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Location</h3>
        </div>
        {mapsOpenUrl && (
          <a
            href={mapsOpenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1C3FAA] hover:text-[#162F82] transition-colors"
          >
            Open in Google Maps
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        )}
      </div>

      {/* Map area */}
      {!address ? (
        /* No address — empty state */
        <div className="flex flex-col items-center justify-center py-14 px-6 bg-gray-50/50">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No address added</p>
          <p className="text-xs text-gray-400 mt-1">Edit this project to add a location</p>
        </div>
      ) : embedSrc ? (
        /* API key present — show embedded map */
        <div className="relative w-full h-[280px] sm:h-[320px]">
          <iframe
            src={embedSrc}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Project location map"
          />
        </div>
      ) : (
        /* No API key — styled placeholder with address */
        <div className="relative overflow-hidden bg-slate-50 h-[200px] flex items-center justify-center">
          {/* Subtle grid background */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#64748b" strokeWidth="0.75"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
          </svg>
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <div className="w-10 h-10 rounded-full bg-[#1C3FAA] shadow-lg flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-2.003 3.5-4.697 3.5-8.08C19.787 4.5 16.162 1.5 12 1.5S4.213 4.5 4.213 9.248c0 3.382 1.555 6.076 3.5 8.08a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.144.742ZM12 13.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 mt-1">
              Add <code className="font-mono bg-gray-200 px-1 py-0.5 rounded text-[11px]">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to enable the embedded map
            </p>
          </div>
        </div>
      )}

      {/* Address footer — shown when address exists */}
      {address && (
        <div className="px-5 py-3.5 flex items-center gap-2.5 border-t border-gray-100 bg-gray-50/40">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p className="text-xs text-gray-600 font-medium">{address}</p>
        </div>
      )}
    </div>
  )
}
