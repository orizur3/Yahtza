export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export async function geocodeAddress(street: string, city: string): Promise<{lat:number;lng:number}|null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  try {
    const query = encodeURIComponent(`${street}, ${city}, Israel`)
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch {}
  return null
}

export type GeoStatus = 'ללא קשר' | 'רחובות קרובים' | 'מקבילים' | 'מצטלבים'
export type Priority = 'דחוף' | 'גבוה' | 'בינוני' | 'רגיל'
export type ReportStatus = 'חדש' | 'ממתין לאימות' | 'הוקצה' | 'כוחות בדרך' | 'כוחות בזירה' | 'בטיפול' | 'הושלם' | 'נסגר כדיווח שווא'

export const PRIORITY_CFG: Record<Priority, {color:string;bg:string;border:string;sort:number}> = {
  'דחוף':  { color:'#a32d2d', bg:'#fcebeb', border:'#f09595', sort:0 },
  'גבוה':  { color:'#633806', bg:'#faeeda', border:'#ef9f27', sort:1 },
  'בינוני':{ color:'#0c447c', bg:'#e6f1fb', border:'#85b7eb', sort:2 },
  'רגיל':  { color:'#444441', bg:'#f1efe8', border:'#b4b2a9', sort:3 },
}

export const STATUS_CFG: Record<ReportStatus, {color:string;bg:string;border:string;dot:string}> = {
  'חדש':              { color:'#a32d2d', bg:'#fcebeb', border:'#f09595', dot:'#e24b4a' },
  'ממתין לאימות':     { color:'#633806', bg:'#faeeda', border:'#ef9f27', dot:'#ba7517' },
  'הוקצה':            { color:'#0c447c', bg:'#e6f1fb', border:'#85b7eb', dot:'#378add' },
  'כוחות בדרך':       { color:'#3c3489', bg:'#eeedfe', border:'#afa9ec', dot:'#7f77dd' },
  'כוחות בזירה':      { color:'#085041', bg:'#e1f5ee', border:'#5dcaa5', dot:'#1d9e75' },
  'בטיפול':           { color:'#085041', bg:'#e1f5ee', border:'#5dcaa5', dot:'#1d9e75' },
  'הושלם':            { color:'#27500a', bg:'#eaf3de', border:'#97c459', dot:'#639922' },
  'נסגר כדיווח שווא': { color:'#5f5e5a', bg:'#f1efe8', border:'#b4b2a9', dot:'#888780' },
}

export const ALL_STATUSES: ReportStatus[] = ['חדש','ממתין לאימות','הוקצה','כוחות בדרך','כוחות בזירה','בטיפול','הושלם','נסגר כדיווח שווא']
export const ALL_PRIORITIES: Priority[] = ['דחוף','גבוה','בינוני','רגיל']

export interface Report {
  id: string
  city: string
  street: string
  location_text: string | null
  maps_url: string | null
  report_time: string
  casualties: number
  reported_by: string | null
  report_content: string | null
  forces_dispatched: string | null
  assigned_unit: string | null
  status: ReportStatus
  priority: Priority
  latitude: number | null
  longitude: number | null
  geo_status: GeoStatus
  geo_related_reports: string[]
  geo_summary: string
  geo_distance_meters: number | null
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  report_id: string
  content: string
  created_by: string
  created_at: string
}

export interface EventLogEntry {
  id: string
  entry_type: string
  content: string
  created_by: string
  related_report_id: string | null
  created_at: string
}

export function computeGeoFields(report: Report, allReports: Report[]): Pick<Report,'geo_status'|'geo_related_reports'|'geo_summary'|'geo_distance_meters'> {
  const { latitude, longitude, street, id } = report
  if (!latitude || !longitude) return { geo_status:'ללא קשר', geo_related_reports:[], geo_summary:'geocoding נכשל', geo_distance_meters:null }
  const nearby: Array<{id:string;street:string;dist:number}> = []
  for (const r of allReports) {
    if (r.id === id || !r.latitude || !r.longitude) continue
    const dist = haversineDistance(latitude, longitude, r.latitude, r.longitude)
    if (dist <= 150) nearby.push({ id: r.id, street: r.street, dist })
  }
  nearby.sort((a,b) => a.dist - b.dist)
  if (!nearby.length) return { geo_status:'ללא קשר', geo_related_reports:[], geo_summary:'', geo_distance_meters:null }
  const c = nearby[0]
  const normalize = (s:string) => s.replace(/[\d\s]/g,'').trim().toLowerCase()
  let status: GeoStatus = 'רחובות קרובים'
  if (c.dist < 40) status = 'מצטלבים'
  else if (normalize(street) !== normalize(c.street) && c.dist <= 120) status = 'מקבילים'
  const summary = status === 'מצטלבים' ? `מצטלב עם ${c.street} (${Math.round(c.dist)} מ')`
    : status === 'מקבילים' ? `מקביל לרחוב ${c.street} (${Math.round(c.dist)} מ')`
    : `קרוב ל${c.street} (${Math.round(c.dist)} מ')`
  return { geo_status:status, geo_related_reports:nearby.map(n=>n.id), geo_summary:summary, geo_distance_meters:Math.round(c.dist) }
}

// Recompute geo for ALL remaining reports after deletion
export function recomputeAllGeo(reports: Report[]): Report[] {
  return reports.map(r => ({
    ...r,
    ...computeGeoFields(r, reports)
  }))
}
