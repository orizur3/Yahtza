'use client'

import { useEffect, useRef } from 'react'
import { Report, GeoStatus } from '../lib/geo'

interface Props {
  reports: Report[]
  onEdit: (r: Report) => void
  onDelete: (id: string) => void
}

const PIN_COLORS: Record<GeoStatus, string> = {
  'מצטלבים': '#e24b4a',
  'מקבילים': '#ba7517',
  'רחובות קרובים': '#ba7517',
  'ללא קשר': '#5f5e5a',
}

const PIN_LABELS: Record<GeoStatus, string> = {
  'מצטלבים': 'מצטלבים',
  'מקבילים': 'מקבילים',
  'רחובות קרובים': 'רחובות קרובים',
  'ללא קשר': 'ללא קשר',
}

export default function ReportsMap({ reports, onEdit, onDelete }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const init = async () => {
      const L = (await import('leaflet')).default

      // Fix default marker icon path issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!mapRef.current) return

      // Initialize map only once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [31.8, 34.9],
          zoom: 10,
          zoomControl: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)
      }

      const map = mapInstanceRef.current

      // Clear existing markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const validReports = reports.filter(r => r.latitude && r.longitude)

      validReports.forEach(r => {
        const color = PIN_COLORS[r.geo_status] ?? '#5f5e5a'
        const statusLabel = PIN_LABELS[r.geo_status] ?? 'ללא קשר'
        const time = new Date(r.report_time).toLocaleString('he-IL', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
        })

        // Custom colored circle marker
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 32px; height: 32px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -34],
        })

        const popup = L.popup({
          maxWidth: 260,
          className: 'geo-popup',
          closeButton: true,
        }).setContent(`
          <div style="direction:rtl; font-family:Arial,sans-serif; padding:4px 0">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px">${r.street}, ${r.city}</div>
            <div style="margin-bottom:6px">
              <span style="
                display:inline-block; padding:2px 8px; border-radius:20px;
                font-size:11px; font-weight:700;
                background:${color}22; color:${color};
                border:1px solid ${color}66;
              ">${statusLabel}</span>
            </div>
            ${r.geo_summary ? `<div style="font-size:12px; color:#dc2626; font-weight:600; margin-bottom:4px">${r.geo_summary}</div>` : ''}
            ${r.report_content ? `<div style="font-size:12px; color:#374151; margin-bottom:6px; line-height:1.4">${r.report_content}</div>` : ''}
            ${(r.casualties ?? 0) > 0 ? `<div style="font-size:12px; color:#dc2626; margin-bottom:6px">נפגעים: <b>${r.casualties}</b></div>` : ''}
            <div style="font-size:11px; color:#9ca3af; margin-bottom:8px">${time}</div>
            <div style="display:flex; gap:6px">
              <button onclick="window.__mapEdit('${r.id}')" style="
                flex:1; padding:5px; border-radius:6px; border:1px solid #bbf7d0;
                background:#f0fdf4; color:#166534; font-size:12px; font-weight:600; cursor:pointer;
              ">עריכה</button>
              <button onclick="window.__mapDelete('${r.id}')" style="
                flex:1; padding:5px; border-radius:6px; border:1px solid #fecaca;
                background:#fef2f2; color:#dc2626; font-size:12px; font-weight:600; cursor:pointer;
              ">מחק</button>
            </div>
          </div>
        `)

        const marker = L.marker([r.latitude!, r.longitude!], { icon })
          .addTo(map)
          .bindPopup(popup)

        markersRef.current.push(marker)
      })

      // Auto-fit map to markers
      if (validReports.length > 0) {
        const bounds = L.latLngBounds(validReports.map(r => [r.latitude!, r.longitude!]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      }
    }

    init()
  }, [reports])

  // Expose edit/delete callbacks to window for popup buttons
  useEffect(() => {
    (window as any).__mapEdit = onEdit.bind(null, reports.find(r => r.id === '') as Report)
    ;(window as any).__mapEdit = (id: string) => {
      const r = reports.find(x => x.id === id)
      if (r) onEdit(r)
    }
    ;(window as any).__mapDelete = (id: string) => {
      onDelete(id)
    }
  }, [reports, onEdit, onDelete])

  const withCoords = reports.filter(r => r.latitude && r.longitude).length
  const withoutCoords = reports.length - withCoords

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: 16 }}>
      {/* Map header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🗺️ מפת אירועים</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{withCoords} אירועים על המפה</span>
          {withoutCoords > 0 && (
            <span style={{ fontSize: 11, color: '#f97316', background: '#fff7ed', padding: '2px 8px', borderRadius: 20, border: '1px solid #fed7aa' }}>
              {withoutCoords} ללא קואורדינטות
            </span>
          )}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {([
            ['מצטלבים', '#e24b4a'],
            ['מקבילים / קרובים', '#ba7517'],
            ['ללא קשר', '#5f5e5a'],
          ] as [string, string][]).map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />

      {/* Map container */}
      <div ref={mapRef} style={{ height: 480, width: '100%' }} />
    </div>
  )
}
