'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { geocodeAddress, computeGeoFields, recomputeAllGeo, Report, GeoStatus, Priority, ReportStatus, PRIORITY_CFG, STATUS_CFG, ALL_STATUSES, ALL_PRIORITIES, Comment } from '../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

declare global { interface Window { google: any; initMap: () => void } }

const GEO_CFG: Record<GeoStatus, {bg:string;color:string;border:string}> = {
  'מצטלבים':       { bg:'#fcebeb', color:'#a32d2d', border:'#f09595' },
  'מקבילים':       { bg:'#faeeda', color:'#633806', border:'#ef9f27' },
  'רחובות קרובים': { bg:'#faeeda', color:'#633806', border:'#ef9f27' },
  'ללא קשר':       { bg:'#f1efe8', color:'#444441', border:'#b4b2a9' },
}

function GeoBadge({ status }: { status: GeoStatus }) {
  const c = GEO_CFG[status] ?? GEO_CFG['ללא קשר']
  return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{status !== 'ללא קשר' && '● '}{status}</span>
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const c = PRIORITY_CFG[priority] ?? PRIORITY_CFG['רגיל']
  const icons: Record<Priority,string> = { 'דחוף':'🔴', 'גבוה':'🟠', 'בינוני':'🟡', 'רגיל':'⚪' }
  return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{icons[priority]} {priority}</span>
}

function Toast({ items, onDismiss }: { items:{id:number;msg:string;type:string}[]; onDismiss:(id:number)=>void }) {
  return (
    <div style={{ position:'fixed', top:14, left:'50%', transform:'translateX(-50%)', zIndex:9999, display:'flex', flexDirection:'column', gap:8, minWidth:340 }}>
      {items.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)} style={{ padding:'11px 16px', borderRadius:10, fontSize:14, fontWeight:500, cursor:'pointer', direction:'rtl', background:t.type==='warn'?'#e24b4a':'#1d9e75', color:'#fff' }}>
          {t.type==='warn'?'⚠️ ':'✓ '}{t.msg}
          <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>לחץ לסגירה</div>
        </div>
      ))}
    </div>
  )
}

// Comments Modal
function CommentsModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('מפעיל')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('report_comments').select('*').eq('report_id', report.id).order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
  }, [report.id])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!text.trim()) return
    setSaving(true)
    await supabase.from('report_comments').insert({ report_id: report.id, content: text.trim(), created_by: author })
    setText('')
    setSaving(false)
    load()
  }

  const inp: React.CSSProperties = { border:'1px solid #d1d5db', borderRadius:7, padding:'7px 10px', fontSize:13, direction:'rtl', outline:'none', width:'100%', boxSizing:'border-box' as any, fontFamily:'Arial,sans-serif' }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:22, width:'100%', maxWidth:480, maxHeight:'80vh', display:'flex', flexDirection:'column', direction:'rtl' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>💬 עדכונים — {report.street}, {report.city}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', marginBottom:12 }}>
          {comments.length === 0
            ? <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>אין עדכונים עדיין</div>
            : comments.map(c => (
              <div key={c.id} style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:8, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>{c.created_by}</span>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(c.created_at).toLocaleString('he-IL', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })}</span>
                </div>
                <div style={{ fontSize:13, color:'#374151' }}>{c.content}</div>
              </div>
            ))
          }
        </div>
        <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12 }}>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="הוסף עדכון..." style={{ ...inp, minHeight:60, resize:'vertical', marginBottom:8 }} />
          <div style={{ display:'flex', gap:8 }}>
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="שמך" style={{ ...inp, width:140 }} />
            <button onClick={add} disabled={saving || !text.trim()} style={{ flex:1, padding:'8px', borderRadius:7, border:'none', background:saving||!text.trim()?'#9ca3af':'#1d4ed8', color:'#fff', fontWeight:700, fontSize:13, cursor:saving||!text.trim()?'default':'pointer' }}>
              {saving ? 'שומר...' : 'הוסף עדכון'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RelatedModal({ report, all, onClose }: { report: Report|null; all: Report[]; onClose: () => void }) {
  if (!report) return null
  const related = all.filter(r => report.geo_related_reports?.includes(r.id))
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:14, padding:22, minWidth:340, maxWidth:500, maxHeight:'80vh', overflowY:'auto', direction:'rtl' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:16 }}>דיווחים קשורים</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {!related.length ? <p style={{ color:'#888', fontSize:13 }}>אין דיווחים קשורים</p> : related.map(r => (
          <div key={r.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>{r.street}, {r.city}</div>
            <div style={{ fontSize:11, color:'#666', marginTop:3 }}>{r.report_content || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InteractiveMap({ reports, focusReport }: { reports: Report[]; focusReport: Report|null }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return
    const withCoords = reports.filter(r => r.latitude && r.longitude)
    const center = focusReport?.latitude ? { lat: focusReport.latitude, lng: focusReport.longitude! }
      : withCoords.length > 0 ? { lat: withCoords[0].latitude!, lng: withCoords[0].longitude! }
      : { lat: 31.9730, lng: 34.7925 }
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center, zoom:14, mapTypeControl:false, fullscreenControl:true, streetViewControl:false })
    } else {
      mapInstanceRef.current.setCenter(center)
      if (focusReport?.latitude) mapInstanceRef.current.setZoom(17)
    }
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    withCoords.forEach(r => {
      const color = r.geo_status==='מצטלבים'?'#e24b4a':r.geo_status==='מקבילים'||r.geo_status==='רחובות קרובים'?'#ba7517':'#185fa5'
      const isActive = focusReport?.id===r.id
      const pc = PRIORITY_CFG[r.priority||'רגיל']
      const marker = new window.google.maps.Marker({
        position: { lat: r.latitude!, lng: r.longitude! },
        map: mapInstanceRef.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: isActive?14:10, fillColor:color, fillOpacity:1, strokeColor:'#fff', strokeWeight:isActive?3:2 },
        zIndex: isActive?999:PRIORITY_CFG[r.priority||'רגיל'].sort===0?10:1,
      })
      const sc = STATUS_CFG[r.status||'חדש']
      const info = `<div style="direction:rtl;font-family:Arial;min-width:200px;padding:4px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.street}, ${r.city}</div>
        <div style="display:flex;gap:6px;margin-bottom:4px">
          <span style="background:${pc.bg};color:${pc.color};border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700">${r.priority||'רגיל'}</span>
          <span style="background:${sc.bg};color:${sc.color};border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700">${r.status||'חדש'}</span>
        </div>
        ${r.assigned_unit?`<div style="font-size:12px;color:#666;margin-bottom:3px">כוח: ${r.assigned_unit}</div>`:''}
        ${r.casualties?`<div style="font-size:12px;color:#dc2626;margin-bottom:3px">נפגעים: ${r.casualties}</div>`:''}
        ${r.geo_summary?`<div style="font-size:12px;color:#b45309;font-weight:600;margin-bottom:3px">${r.geo_summary}</div>`:''}
        ${r.report_content?`<div style="font-size:12px;color:#374151">${r.report_content}</div>`:''}
      </div>`
      const iw = new window.google.maps.InfoWindow({ content: info })
      marker.addListener('click', () => { markersRef.current.forEach(m => m._iw?.close()); iw.open(mapInstanceRef.current, marker); marker._iw = iw })
      markersRef.current.push(marker)
    })
  }, [reports, focusReport])

  useEffect(() => {
    if (!apiKey) return
    if (window.google) { initMap(); return }
    window.initMap = initMap
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
    s.async = true
    document.head.appendChild(s)
    return () => { if (s.parentNode) s.parentNode.removeChild(s) }
  }, [])

  useEffect(() => { if (window.google) initMap() }, [reports, focusReport, initMap])

  return (
    <div style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
      <div style={{ background:'#1e293b', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', direction:'rtl' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🗺 מפת דיווחים</span>
          <span style={{ fontSize:11, color:'#94a3b8' }}>{reports.filter(r=>r.latitude).length} דיווחים</span>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:11, color:'#94a3b8' }}>
          <span>🔵 ללא קשר</span><span>🟠 קרובים</span><span>🔴 מצטלבים</span>
        </div>
      </div>
      <div ref={mapRef} style={{ width:'100%', height:420 }}>
        {!apiKey && <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:13 }}>Google Maps API Key לא מוגדר</div>}
      </div>
    </div>
  )
}

function exportToCSV(reports: Report[]) {
  const headers = ['עיר','רחוב','שעת דיווח','עדיפות','סטטוס','כוח מוקצה','נפגעים','מדווח','תוכן','כוחות','קשר גיאוגרפי','פירוט קשר']
  const rows = reports.map(r => [r.city,r.street,new Date(r.report_time).toLocaleString('he-IL'),r.priority||'רגיל',r.status||'חדש',r.assigned_unit||'',r.casualties??0,r.reported_by??'',r.report_content??'',r.forces_dispatched??'',r.geo_status,r.geo_summary??''])
  const csv = [headers,...rows].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}))
  a.download = `דיווחים_${new Date().toLocaleDateString('he-IL').replace(/\//g,'-')}.csv`
  a.click()
}

function exportDailySummary(reports: Report[]) {
  const today = new Date().toLocaleDateString('he-IL')
  const open = reports.filter(r => !['הושלם','נסגר כדיווח שווא'].includes(r.status))
  const closed = reports.filter(r => ['הושלם','נסגר כדיווח שווא'].includes(r.status))
  const cityCount: Record<string,number> = {}
  reports.forEach(r => { cityCount[r.city] = (cityCount[r.city]||0)+1 })
  const topCities = Object.entries(cityCount).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const html = `<html dir="rtl"><head><meta charset="utf-8"><title>סיכום יומי</title>
  <style>body{font-family:Arial;direction:rtl;padding:30px;font-size:13px}h1{font-size:22px;color:#0f172a}h2{font-size:16px;color:#1e293b;margin-top:24px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}.stat{display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;margin:6px;text-align:center}.stat-n{font-size:28px;font-weight:800;color:#1d4ed8}.stat-l{font-size:12px;color:#6b7280}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#0f172a;color:white;padding:8px;text-align:right;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}</style>
  </head><body>
  <h1>🎯 סיכום יומי — ${today}</h1>
  <p style="color:#6b7280">הופק ב-${new Date().toLocaleTimeString('he-IL')}</p>
  <div>
    <div class="stat"><div class="stat-n">${reports.length}</div><div class="stat-l">סה"כ אירועים</div></div>
    <div class="stat"><div class="stat-n" style="color:#e24b4a">${open.length}</div><div class="stat-l">פתוחים</div></div>
    <div class="stat"><div class="stat-n" style="color:#1d9e75">${closed.length}</div><div class="stat-l">סגורים</div></div>
    <div class="stat"><div class="stat-n" style="color:#a32d2d">${reports.filter(r=>r.priority==='דחוף').length}</div><div class="stat-l">דחופים</div></div>
    <div class="stat"><div class="stat-n" style="color:#7f77dd">${reports.reduce((a,r)=>a+(r.casualties||0),0)}</div><div class="stat-l">נפגעים</div></div>
  </div>
  <h2>עומס לפי עיר</h2>
  <table><thead><tr><th>עיר</th><th>אירועים</th></tr></thead><tbody>
    ${topCities.map(([c,n])=>`<tr><td>${c}</td><td>${n}</td></tr>`).join('')}
  </tbody></table>
  <h2>פילוח לפי סטטוס</h2>
  <table><thead><tr><th>סטטוס</th><th>כמות</th></tr></thead><tbody>
    ${ALL_STATUSES.map(s=>`<tr><td>${s}</td><td>${reports.filter(r=>r.status===s).length}</td></tr>`).join('')}
  </tbody></table>
  <h2>אירועים פתוחים</h2>
  <table><thead><tr><th>עיר</th><th>רחוב</th><th>עדיפות</th><th>סטטוס</th><th>כוח</th><th>שעה</th></tr></thead><tbody>
    ${open.map(r=>`<tr><td>${r.city}</td><td>${r.street}</td><td>${r.priority||'רגיל'}</td><td>${r.status}</td><td>${r.assigned_unit||'—'}</td><td>${new Date(r.report_time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`
  const win = window.open('','_blank')
  if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),500)}
}

type FormData = { city:string;street:string;casualties:number;reported_by:string;report_content:string;forces_dispatched:string;status:ReportStatus;priority:Priority;assigned_unit:string }
const emptyForm = ():FormData => ({city:'',street:'',casualties:0,reported_by:'',report_content:'',forces_dispatched:'',status:'חדש',priority:'רגיל',assigned_unit:''})

function ReportForm({initial,onSubmit,onCancel,geocoding}:{initial?:FormData;onSubmit:(f:FormData)=>void;onCancel:()=>void;geocoding:boolean}) {
  const [form,setForm] = useState<FormData>(initial??emptyForm())
  const set = (k:keyof FormData)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm(f=>({...f,[k]:e.target.value}))
  const inp:React.CSSProperties = {width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:7,fontSize:13,fontFamily:'Arial,sans-serif',direction:'rtl',outline:'none',boxSizing:'border-box' as any}
  return (
    <div style={{direction:'rtl'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px'}}>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>עיר *</label><input style={inp} value={form.city} onChange={set('city')} placeholder="תל אביב"/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>רחוב *</label><input style={inp} value={form.street} onChange={set('street')} placeholder="הרצל 12"/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>עדיפות</label>
          <select style={inp} value={form.priority} onChange={set('priority')}>
            {ALL_PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>סטטוס</label>
          <select style={inp} value={form.status} onChange={set('status')}>
            {ALL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>כוח מוקצה</label><input style={inp} value={form.assigned_unit} onChange={set('assigned_unit')} placeholder="ניידת 3, יחידה א..."/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>נפגעים</label><input style={inp} type="number" min={0} value={form.casualties} onChange={set('casualties')}/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>מדווח</label><input style={inp} value={form.reported_by} onChange={set('reported_by')} placeholder="שם המדווח"/></div>
        <div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>כוחות שנשלחו</label><input style={inp} value={form.forces_dispatched} onChange={set('forces_dispatched')} placeholder="ניידת, אמבולנס..."/></div>
        <div style={{gridColumn:'1 / -1'}}><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:4,color:'#374151'}}>תוכן דיווח</label><textarea style={{...inp,resize:'vertical',minHeight:58} as any} value={form.report_content} onChange={set('report_content')}/></div>
      </div>
      {geocoding && <div style={{marginTop:10,padding:'8px 12px',background:'#eff6ff',borderRadius:7,fontSize:12,color:'#1d4ed8'}}>⏳ מבצע Geocoding...</div>}
      <div style={{display:'flex',gap:8,marginTop:14,justifyContent:'flex-end'}}>
        <button onClick={onCancel} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #d1d5db',background:'#fff',cursor:'pointer',fontSize:13}}>ביטול</button>
        <button onClick={()=>{if(!form.city||!form.street){alert('עיר ורחוב הם שדות חובה');return;}onSubmit(form)}} disabled={geocoding}
          style={{padding:'8px 22px',borderRadius:7,border:'none',background:geocoding?'#9ca3af':'#1d4ed8',color:'#fff',fontWeight:700,fontSize:13,cursor:geocoding?'default':'pointer'}}>
          {geocoding?'מבצע Geocoding...':initial?'עדכן דיווח':'שמור דיווח'}
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  const [reports,setReports] = useState<Report[]>([])
  const [loading,setLoading] = useState(true)
  const [showForm,setShowForm] = useState(false)
  const [editReport,setEditReport] = useState<Report|null>(null)
  const [relatedModal,setRelatedModal] = useState<Report|null>(null)
  const [commentsReport,setCommentsReport] = useState<Report|null>(null)
  const [focusReport,setFocusReport] = useState<Report|null>(null)
  const [toasts,setToasts] = useState<{id:number;msg:string;type:string}[]>([])
  const [geocoding,setGeocoding] = useState(false)
  const [showAdvSearch,setShowAdvSearch] = useState(false)
  const [search,setSearch] = useState('')
  const [filterGeoStatus,setFilterGeoStatus] = useState('')
  const [filterReportStatus,setFilterReportStatus] = useState('')
  const [filterPriority,setFilterPriority] = useState('')
  const [filterCity,setFilterCity] = useState('')
  const [filterDateFrom,setFilterDateFrom] = useState('')
  const [filterDateTo,setFilterDateTo] = useState('')
  const router = useRouter()
  const mapSectionRef = useRef<HTMLDivElement>(null)

  const toast = useCallback((msg:string,type='warn')=>{
    const id=Date.now()
    setToasts(t=>[{id,msg,type},...t])
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),6000)
  },[])

  const loadReports = useCallback(async()=>{
    const {data} = await supabase.from('reports').select('*').order('report_time',{ascending:false})
    if(data) setReports(data as Report[])
    setLoading(false)
  },[])

  useEffect(()=>{
    loadReports()
    const ch = supabase.channel('reports-v5')
      .on('postgres_changes',{event:'*',schema:'public',table:'reports'},()=>loadReports())
      .subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[loadReports])

  const handleLogout = async()=>{ await fetch('/api/logout',{method:'POST'}); router.push('/login') }
  const focusOnMap = (r:Report) => { setFocusReport(r); mapSectionRef.current?.scrollIntoView({behavior:'smooth',block:'center'}) }

  const quickUpdate = async (id:string, fields: Partial<Report>) => {
    await supabase.from('reports').update(fields).eq('id', id)
    loadReports()
  }

  const handleCreate = async(form:FormData)=>{
    setGeocoding(true)
    const coords = await geocodeAddress(form.street,form.city)
    setGeocoding(false)
    if(!coords) toast('Geocoding נכשל','warn')
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.street+','+form.city+',Israel')}`
    const newReport = {
      city:form.city,street:form.street,location_text:`${form.street}, ${form.city}`,maps_url:mapsUrl,
      report_time:new Date().toISOString(),casualties:Number(form.casualties)||0,
      reported_by:form.reported_by||null,report_content:form.report_content||null,
      forces_dispatched:form.forces_dispatched||null,status:form.status||'חדש',
      priority:form.priority||'רגיל',assigned_unit:form.assigned_unit||null,
      latitude:coords?.lat??null,longitude:coords?.lng??null,
      geo_status:'ללא קשר' as GeoStatus,geo_related_reports:[],geo_summary:coords?'':'geocoding נכשל',geo_distance_meters:null,
    }
    const {data:inserted} = await supabase.from('reports').insert(newReport).select().single()
    if(!inserted){toast('שגיאה בשמירת הדיווח','warn');return}
    const allWithNew = [...reports, inserted as Report]
    const geoFields = computeGeoFields(inserted as Report, allWithNew)
    await supabase.from('reports').update(geoFields).eq('id',inserted.id)
    if(geoFields.geo_status!=='ללא קשר'){
      toast(`נמצא קשר גיאוגרפי: ${geoFields.geo_summary}`,'warn')
      for(const relId of geoFields.geo_related_reports){
        const rel = allWithNew.find(r=>r.id===relId)
        if(rel) await supabase.from('reports').update(computeGeoFields(rel,allWithNew)).eq('id',relId)
      }
    } else { toast(`הדיווח נשמר: ${form.street}, ${form.city}`,'ok') }
    setShowForm(false); loadReports()
  }

  const handleUpdate = async(form:FormData)=>{
    if(!editReport) return
    setGeocoding(true)
    let lat=editReport.latitude,lng=editReport.longitude
    if(form.street!==editReport.street||form.city!==editReport.city){
      const coords = await geocodeAddress(form.street,form.city)
      if(coords){lat=coords.lat;lng=coords.lng}
    }
    setGeocoding(false)
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.street+','+form.city+',Israel')}`
    const updated = {...form,latitude:lat,longitude:lng,maps_url:mapsUrl,location_text:`${form.street}, ${form.city}`}
    const geoFields = computeGeoFields({...editReport,...updated} as Report,reports)
    await supabase.from('reports').update({...updated,...geoFields}).eq('id',editReport.id)
    setEditReport(null); loadReports()
  }

  // BUG FIX: After deletion, recompute geo for all remaining reports
  const handleDelete = async(id:string)=>{
    if(!confirm('למחוק את הדיווח?')) return
    await supabase.from('reports').delete().eq('id',id)
    const remaining = reports.filter(r=>r.id!==id)
    const recomputed = recomputeAllGeo(remaining)
    // Update all affected reports in DB
    for(const r of recomputed){
      const orig = remaining.find(x=>x.id===r.id)
      if(orig && (orig.geo_status!==r.geo_status || JSON.stringify(orig.geo_related_reports)!==JSON.stringify(r.geo_related_reports))){
        await supabase.from('reports').update({
          geo_status:r.geo_status,
          geo_related_reports:r.geo_related_reports,
          geo_summary:r.geo_summary,
          geo_distance_meters:r.geo_distance_meters
        }).eq('id',r.id)
      }
    }
    loadReports()
  }

  // Sort by priority first
  const sortedReports = [...reports].sort((a,b) => {
    const pa = PRIORITY_CFG[a.priority||'רגיל'].sort
    const pb = PRIORITY_CFG[b.priority||'רגיל'].sort
    if(pa!==pb) return pa-pb
    return new Date(b.report_time).getTime()-new Date(a.report_time).getTime()
  })

  const filtered = sortedReports.filter(r=>{
    const s = `${r.city} ${r.street} ${r.report_content??''} ${r.assigned_unit??''}`.toLowerCase()
    const rDate = new Date(r.report_time)
    return (
      (!search||s.includes(search.toLowerCase())) &&
      (!filterGeoStatus||r.geo_status===filterGeoStatus) &&
      (!filterReportStatus||r.status===filterReportStatus) &&
      (!filterPriority||r.priority===filterPriority) &&
      (!filterCity||r.city===filterCity) &&
      (!filterDateFrom||rDate>=new Date(filterDateFrom)) &&
      (!filterDateTo||rDate<=new Date(filterDateTo+'T23:59:59'))
    )
  })

  const cities = reports.map(r=>r.city).filter((v,i,a)=>v&&a.indexOf(v)===i)
  const openCount = reports.filter(r=>!['הושלם','נסגר כדיווח שווא'].includes(r.status)).length
  const criticalCount = reports.filter(r=>r.priority==='דחוף'&&!['הושלם','נסגר כדיווח שווא'].includes(r.status)).length
  const hasActiveFilters = search||filterGeoStatus||filterReportStatus||filterPriority||filterCity||filterDateFrom||filterDateTo

  const cell:React.CSSProperties = {padding:'9px 10px',fontSize:12,borderBottom:'1px solid #f0f0f0',verticalAlign:'middle'}
  const thStyle:React.CSSProperties = {padding:'8px 10px',fontSize:11,fontWeight:700,color:'#6b7280',background:'#f9fafb',textAlign:'right',whiteSpace:'nowrap',borderBottom:'1px solid #e5e7eb'}
  const inp:React.CSSProperties = {border:'1px solid #d1d5db',borderRadius:7,padding:'7px 10px',fontSize:13,direction:'rtl',outline:'none'}

  return (
    <div style={{direction:'rtl',minHeight:'100vh',background:'#f3f4f6',fontFamily:'Arial,sans-serif'}}>
      <Toast items={toasts} onDismiss={id=>setToasts(t=>t.filter(x=>x.id!==id))}/>
      <RelatedModal report={relatedModal} all={reports} onClose={()=>setRelatedModal(null)}/>
      {commentsReport && <CommentsModal report={commentsReport} onClose={()=>setCommentsReport(null)}/>}

      {/* Header */}
      <div style={{background:'#0f172a',padding:'10px 22px',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={()=>router.push('/dashboard')} style={{background:'#450a0a',color:'#fca5a5',border:'1px solid #7f1d1d',borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>📊 דשבורד</button>
          <button onClick={()=>router.push('/timeline')} style={{background:'#1e3a5f',color:'#93c5fd',border:'1px solid #1d4ed8',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>🕐 Timeline</button>
          <button onClick={()=>router.push('/log')} style={{background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>📖 יומן</button>
          <button onClick={()=>exportToCSV(filtered)} style={{background:'#14532d',color:'#86efac',border:'1px solid #166534',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>📊 Excel</button>
          <button onClick={()=>exportDailySummary(reports)} style={{background:'#3b0764',color:'#d8b4fe',border:'1px solid #7e22ce',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>📋 סיכום יומי</button>
          <button onClick={handleLogout} style={{background:'none',color:'#94a3b8',border:'1px solid #334155',borderRadius:8,padding:'7px 10px',fontSize:12,cursor:'pointer'}}>יציאה</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <Image src="/logo.png" alt="ISR-1" width={48} height={48} style={{borderRadius:'50%'}}/>
          <div style={{color:'#fff',fontWeight:700,fontSize:14,textAlign:'center'}}>מערכת ניהול אירועים</div>
          <div style={{color:'#94a3b8',fontSize:10}}>ISR-1 | ניהול גיאוגרפי בזמן אמת</div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center'}}>
          {criticalCount>0 && <div style={{background:'#450a0a',borderRadius:8,padding:'6px 12px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#f87171'}}>{criticalCount}</div>
            <div style={{fontSize:10,color:'#94a3b8'}}>דחופים</div>
          </div>}
          <div style={{background:'#1e293b',borderRadius:8,padding:'6px 12px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#60a5fa'}}>{openCount}</div>
            <div style={{fontSize:10,color:'#94a3b8'}}>פתוחים</div>
          </div>
          <button onClick={()=>{setShowForm(true);setEditReport(null)}} style={{background:'#e24b4a',color:'#fff',border:'none',borderRadius:8,padding:'9px 16px',fontWeight:700,fontSize:13,cursor:'pointer'}}>+ דיווח חדש</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{background:'#1e293b',padding:'8px 22px',display:'flex',gap:18,flexWrap:'wrap'}}>
        {[
          {n:reports.length,l:'סה"כ',c:'#60a5fa'},
          {n:reports.filter(r=>r.priority==='דחוף').length,l:'דחוף',c:'#f87171'},
          {n:reports.filter(r=>r.priority==='גבוה').length,l:'גבוה',c:'#f97316'},
          {n:openCount,l:'פתוחים',c:'#a78bfa'},
          {n:reports.filter(r=>r.geo_status!=='ללא קשר').length,l:'קשר גיאו',c:'#fac775'},
          {n:reports.reduce((a,r)=>a+(r.casualties||0),0),l:'נפגעים',c:'#f09595'},
        ].map(s=>(
          <div key={s.l} style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:18,fontWeight:700,color:s.c}}>{s.n}</span>
            <span style={{fontSize:11,color:'#94a3b8'}}>{s.l}</span>
          </div>
        ))}
      </div>

      <div style={{padding:16}}>
        {(showForm||editReport) && (
          <div style={{background:'#fff',borderRadius:12,padding:18,marginBottom:14,border:'1px solid #e5e7eb'}}>
            <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>{editReport?'עריכת דיווח':'דיווח חדש'}</h3>
            <ReportForm
              initial={editReport?{city:editReport.city,street:editReport.street,casualties:editReport.casualties,reported_by:editReport.reported_by??'',report_content:editReport.report_content??'',forces_dispatched:editReport.forces_dispatched??'',status:(editReport.status||'חדש') as ReportStatus,priority:(editReport.priority||'רגיל') as Priority,assigned_unit:editReport.assigned_unit??''}:undefined}
              onSubmit={editReport?handleUpdate:handleCreate}
              onCancel={()=>{setShowForm(false);setEditReport(null)}}
              geocoding={geocoding}
            />
          </div>
        )}

        {/* Filters */}
        <div style={{background:'#fff',borderRadius:10,padding:'10px 14px',marginBottom:12,border:'1px solid #e5e7eb'}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="חיפוש חופשי..." style={{...inp,width:180}}/>
            <select value={filterReportStatus} onChange={e=>setFilterReportStatus(e.target.value)} style={inp}>
              <option value="">כל הסטטוסים</option>
              {ALL_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={inp}>
              <option value="">כל העדיפויות</option>
              {ALL_PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
            <select value={filterCity} onChange={e=>setFilterCity(e.target.value)} style={inp}>
              <option value="">כל הערים</option>
              {cities.map(c=><option key={c}>{c}</option>)}
            </select>
            <button onClick={()=>setShowAdvSearch(!showAdvSearch)} style={{...inp,background:showAdvSearch?'#eff6ff':'#fff',color:showAdvSearch?'#1d4ed8':'#374151',cursor:'pointer'}}>
              🔍 מתקדם {showAdvSearch?'▲':'▼'}
            </button>
            {hasActiveFilters && <button onClick={()=>{setSearch('');setFilterGeoStatus('');setFilterReportStatus('');setFilterPriority('');setFilterCity('');setFilterDateFrom('');setFilterDateTo('')}} style={{...inp,background:'#fef2f2',color:'#dc2626',cursor:'pointer',border:'1px solid #fecaca'}}>✕ נקה</button>}
            <span style={{fontSize:12,color:'#6b7280',marginRight:'auto'}}>{filtered.length} דיווחים</span>
          </div>
          {showAdvSearch && (
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f0f0f0',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <label style={{fontSize:12,color:'#6b7280'}}>מתאריך:</label>
                <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={inp}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <label style={{fontSize:12,color:'#6b7280'}}>עד:</label>
                <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={inp}/>
              </div>
              <select value={filterGeoStatus} onChange={e=>setFilterGeoStatus(e.target.value)} style={inp}>
                <option value="">כל קשרי הגיאו</option>
                {(['מצטלבים','מקבילים','רחובות קרובים','ללא קשר'] as GeoStatus[]).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:18}}>
          {loading?(
            <div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>טוען...</div>
          ):filtered.length===0?(
            <div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>{reports.length===0?'אין דיווחים — לחץ + דיווח חדש':'לא נמצאו תוצאות'}</div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:1100}}>
                <thead>
                  <tr>{['עדיפות','עיר','רחוב','שעה','סטטוס','כוח','נפגעים','תוכן','🔴 גיאו','🧠 פירוט','קשור','💬','מפה','פעולות'].map(h=>(
                    <th key={h} style={{...thStyle,textAlign:['נפגעים','מפה','פעולות','💬'].includes(h)?'center':'right'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(r=>{
                    const rowBg = r.priority==='דחוף'&&!['הושלם','נסגר כדיווח שווא'].includes(r.status)?'#fff5f5'
                      : focusReport?.id===r.id?'#eff6ff'
                      : r.geo_status==='מצטלבים'?'#fff9f9'
                      : 'transparent'
                    const pc = PRIORITY_CFG[r.priority||'רגיל']
                    const sc = STATUS_CFG[r.status||'חדש']
                    const hasGeo = r.geo_status!=='ללא קשר'
                    return(
                      <tr key={r.id} style={{background:rowBg,cursor:'pointer'}} onClick={()=>focusOnMap(r)}>
                        <td style={cell} onClick={e=>e.stopPropagation()}>
                          <select value={r.priority||'רגיל'} onChange={e=>quickUpdate(r.id,{priority:e.target.value as Priority})}
                            style={{border:`1px solid ${pc.border}`,borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,background:pc.bg,color:pc.color,cursor:'pointer',outline:'none',direction:'rtl'}}>
                            {ALL_PRIORITIES.map(p=><option key={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={cell}><b>{r.city}</b></td>
                        <td style={cell}>{r.street}</td>
                        <td style={{...cell,whiteSpace:'nowrap',color:'#6b7280',fontSize:11}}>{new Date(r.report_time).toLocaleString('he-IL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</td>
                        <td style={cell} onClick={e=>e.stopPropagation()}>
                          <select value={r.status||'חדש'} onChange={e=>quickUpdate(r.id,{status:e.target.value as ReportStatus})}
                            style={{border:`1px solid ${sc.border}`,borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,background:sc.bg,color:sc.color,cursor:'pointer',outline:'none',direction:'rtl',maxWidth:110}}>
                            {ALL_STATUSES.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{...cell,maxWidth:90,fontSize:11,color:r.assigned_unit?'#374151':'#d1d5db'}}><span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:80}}>{r.assigned_unit||'—'}</span></td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {(r.casualties??0)>0?<span style={{background:'#fee2e2',color:'#dc2626',borderRadius:20,padding:'2px 7px',fontSize:11,fontWeight:700}}>{r.casualties}</span>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,maxWidth:120}}><span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:110,fontSize:11}}>{r.report_content||<span style={{color:'#d1d5db'}}>—</span>}</span></td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}><GeoBadge status={r.geo_status}/></td>
                        <td style={cell}>{r.geo_summary?<span style={{fontSize:11,fontWeight:hasGeo?600:400,color:hasGeo?'#dc2626':'#6b7280'}}>{r.geo_summary}</span>:<span style={{color:'#d1d5db'}}>—</span>}</td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {r.geo_related_reports?.length?<button onClick={()=>setRelatedModal(r)} style={{background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:7,padding:'3px 7px',fontSize:11,cursor:'pointer',fontWeight:600}}>צפה ({r.geo_related_reports.length})</button>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setCommentsReport(r)} style={{background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:7,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>💬</button>
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          {r.maps_url?<a href={r.maps_url} target="_blank" rel="noreferrer" style={{color:'#1d4ed8',fontSize:11,textDecoration:'none'}}>📍</a>:<span style={{color:'#d1d5db'}}>—</span>}
                        </td>
                        <td style={{...cell,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',gap:3,justifyContent:'center'}}>
                            <button onClick={()=>{setEditReport(r);setShowForm(false);window.scrollTo(0,0)}} style={{background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:6,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>עריכה</button>
                            <button onClick={()=>handleDelete(r.id)} style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:6,padding:'3px 7px',fontSize:11,cursor:'pointer'}}>מחק</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Map */}
        <div ref={mapSectionRef}>
          <InteractiveMap reports={reports} focusReport={focusReport}/>
        </div>
      </div>
    </div>
  )
}
