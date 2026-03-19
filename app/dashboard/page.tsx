'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Report, Priority, ReportStatus, PRIORITY_CFG, STATUS_CFG, ALL_STATUSES } from '../../lib/geo'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function StatCard({ n, label, color, sub }: { n: number|string; label: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px', minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{n}</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function AlertRow({ report, label }: { report: Report; label: string }) {
  const router = useRouter()
  const pc = PRIORITY_CFG[report.priority || 'רגיל']
  return (
    <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #1e293b', cursor: 'pointer' }}>
      <span style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{report.priority || 'רגיל'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{report.street}, {report.city}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      </div>
      <div style={{ fontSize: 11, color: '#475569' }}>{new Date(report.report_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  )
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [now, setNow] = useState(new Date())
  const router = useRouter()

  const load = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*').order('report_time', { ascending: false })
    if (data) setReports(data as Report[])
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('dash').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, load).subscribe()
    const ticker = setInterval(() => setNow(new Date()), 30000)
    return () => { supabase.removeChannel(ch); clearInterval(ticker) }
  }, [load])

  const open = reports.filter(r => !['הושלם','נסגר כדיווח שווא'].includes(r.status))
  const critical = reports.filter(r => r.priority === 'דחוף' && !['הושלם','נסגר כדיווח שווא'].includes(r.status))
  const withCasualties = reports.filter(r => (r.casualties || 0) > 0 && !['הושלם','נסגר כדיווח שווא'].includes(r.status))
  const noUnit = open.filter(r => !r.assigned_unit)
  const longOpen = open.filter(r => (now.getTime() - new Date(r.report_time).getTime()) > 30 * 60 * 1000)

  // City breakdown
  const cityCount: Record<string, number> = {}
  open.forEach(r => { cityCount[r.city] = (cityCount[r.city] || 0) + 1 })
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Status breakdown
  const statusCount: Record<string, number> = {}
  reports.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1 })

  const card: React.CSSProperties = { background: '#0f172a', borderRadius: 14, overflow: 'hidden', border: '1px solid #1e293b' }
  const cardTitle: React.CSSProperties = { background: '#1e293b', padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: '#0a0f1a', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '10px 22px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>→ טבלה</button>
          <button onClick={() => router.push('/timeline')} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>🕐 יומן</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Image src="/logo.png" alt="ISR-1" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>דשבורד פיקוד</div>
          <div style={{ color: '#475569', fontSize: 10 }}>{now.toLocaleString('he-IL')}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: open.length > 0 ? '#450a0a' : '#14532d', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: open.length > 0 ? '#f87171' : '#4ade80' }}>{open.length}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>אירועים פתוחים</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 18 }}>

        {/* Top stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <StatCard n={open.length} label="פתוחים כעת" color="#f87171" />
          <StatCard n={critical.length} label="דחופים פעילים" color="#e24b4a" />
          <StatCard n={withCasualties.length} label="עם נפגעים" color="#a78bfa" />
          <StatCard n={noUnit.length} label="ללא כוח מוקצה" color="#f97316" />
          <StatCard n={longOpen.length} label="פתוחים >30 דקות" color="#fac775" />
          <StatCard n={reports.length} label="סה\"כ היום" color="#60a5fa" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Critical incidents */}
          <div style={card}>
            <div style={cardTitle}>🔴 אירועים דחופים פעילים</div>
            {critical.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>אין אירועים דחופים כרגע</div>
              : critical.slice(0, 5).map(r => <AlertRow key={r.id} report={r} label={r.report_content || r.street + ', ' + r.city} />)
            }
          </div>

          {/* Long open */}
          <div style={card}>
            <div style={cardTitle}>⏱ פתוחים מעל 30 דקות</div>
            {longOpen.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>אין אירועים ממתינים זמן רב</div>
              : longOpen.slice(0, 5).map(r => {
                  const mins = Math.round((now.getTime() - new Date(r.report_time).getTime()) / 60000)
                  return <AlertRow key={r.id} report={r} label={`פתוח ${mins} דקות`} />
                })
            }
          </div>

          {/* Status breakdown */}
          <div style={card}>
            <div style={cardTitle}>📊 פילוח לפי סטטוס</div>
            <div style={{ padding: '12px 16px' }}>
              {ALL_STATUSES.map(s => {
                const count = statusCount[s] || 0
                const cfg = STATUS_CFG[s]
                const pct = reports.length > 0 ? Math.round((count / reports.length) * 100) : 0
                return (
                  <div key={s} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{s}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.dot }}>{count}</span>
                    </div>
                    <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: cfg.dot, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* City breakdown */}
          <div style={card}>
            <div style={cardTitle}>🏙 עומס לפי עיר</div>
            <div style={{ padding: '12px 16px' }}>
              {topCities.length === 0
                ? <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 20 }}>אין נתונים</div>
                : topCities.map(([city, count]) => {
                    const max = topCities[0][1]
                    const pct = Math.round((count / max) * 100)
                    return (
                      <div key={city} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{city}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{count} אירועים</span>
                        </div>
                        <div style={{ background: '#1e293b', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #185fa5, #60a5fa)', height: '100%', borderRadius: 4 }} />
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        </div>

        {/* Incidents with casualties */}
        {withCasualties.length > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={cardTitle}>🚑 אירועים פעילים עם נפגעים</div>
            {withCasualties.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1e293b', cursor: 'pointer' }} onClick={() => router.push('/')}>
                <span style={{ background: '#450a0a', color: '#f87171', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{r.casualties} נפגעים</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{r.street}, {r.city}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.report_content || '—'}</div>
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>{new Date(r.report_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        )}

        {/* No unit assigned */}
        {noUnit.length > 0 && (
          <div style={card}>
            <div style={cardTitle}>⚠️ אירועים ללא כוח מוקצה</div>
            {noUnit.slice(0, 5).map(r => <AlertRow key={r.id} report={r} label="לא הוקצה כוח" />)}
            {noUnit.length > 5 && <div style={{ padding: '8px 16px', fontSize: 12, color: '#475569', textAlign: 'center' }}>ועוד {noUnit.length - 5} אירועים...</div>}
          </div>
        )}
      </div>
    </div>
  )
}
