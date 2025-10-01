import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { ProgressSpinner } from 'primereact/progressspinner'
import { OverlayPanel } from 'primereact/overlaypanel'
import { Button } from 'primereact/button'
import { InputNumber } from 'primereact/inputnumber'
import ChevronDown from './assets/chevron-down-svgrepo-com.svg'
import type { DataTablePageEvent } from 'primereact/datatable'

// Types for API
interface ArtworkApiRecord {
  id: number
  title: string
  place_of_origin: string | null
  artist_display: string | null
  inscriptions: string | null
  date_start: number | null
  date_end: number | null
}

interface ApiResponse {
  pagination: {
    total: number
    limit: number
    offset: number
    total_pages: number
    current_page: number
    prev_url: string | null
    next_url: string | null
  }
  data: ArtworkApiRecord[]
}

const BASE_URL = 'https://api.artic.edu/api/v1/artworks'
const FIELDS = ['id','title','place_of_origin','artist_display','inscriptions','date_start','date_end']

// urlbuilder for api call
function buildUrl(page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(pageSize))
  params.set('fields', FIELDS.join(','))
  return `${BASE_URL}?${params.toString()}`
}

// persist selection across navigation
type ArtworkSelectionMap = Map<number, ArtworkApiRecord>

function App() {
  const [records, setRecords] = useState<ArtworkApiRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1) 
  const [rows, setRows] = useState(12) 
  const selectionMapRef = useRef<ArtworkSelectionMap>(new Map())
  const [pageSelection, setPageSelection] = useState<ArtworkApiRecord[]>([])
  const bulkOverlayRef = useRef<OverlayPanel>(null)
  const [bulkCount, setBulkCount] = useState<number | null>(null)
  const STORAGE_KEY = 'artworkSelection'

  const fetchPage = useCallback(async (pageToFetch: number, pageSize: number) => {
    setLoading(true)
    try {
      const url = buildUrl(pageToFetch, pageSize)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const json: ApiResponse = await res.json()
      setRecords(json.data)
      setTotalRecords(json.pagination.total)
      const selectedOnThisPage: ArtworkApiRecord[] = []
      for (const r of json.data) {
        if (selectionMapRef.current.has(r.id)) {
          selectedOnThisPage.push(selectionMapRef.current.get(r.id)!)
        }
      }
      setPageSelection(selectedOnThisPage)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // restore persisted selection first
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as ArtworkApiRecord[]
        for (const rec of arr) selectionMapRef.current.set(rec.id, rec)
      }
    } catch (e) {
      console.warn('Restore selection failed', e)
    }
  }, [])

  useEffect(() => {
    fetchPage(page, rows)
  }, [fetchPage, page, rows])

  const onPage = (event: DataTablePageEvent) => {
    const newPage = event.page !== undefined ? event.page + 1 : 1
    const newRows = event.rows
    setPage(newPage)
    if (newRows !== rows) setRows(newRows)
  }

  const persistSelection = () => {
    try {
      const data = Array.from(selectionMapRef.current.values())
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Persist selection failed', e)
    }
  }

  const onSelectionChange = (e: any) => {
    const newSelection: ArtworkApiRecord[] = (e.value as ArtworkApiRecord[]) || []
    for (const r of records) {
      if (selectionMapRef.current.has(r.id) && !newSelection.find(s => s.id === r.id)) {
        selectionMapRef.current.delete(r.id)
      }
    }
    for (const rec of newSelection) selectionMapRef.current.set(rec.id, rec)
    setPageSelection(newSelection)
    persistSelection()
  }
  const fetchPageDataRaw = useCallback(async (pageToFetch: number, pageSize: number): Promise<ArtworkApiRecord[] | null> => {
    try {
      const url = buildUrl(pageToFetch, pageSize)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const json: ApiResponse = await res.json()
      return json.data
    } catch (err) {
      console.error(err)
      return null
    }
  }, [])

  const bulkSelect = async (target: number) => {
    if (target <= 0) return
    let selected = selectionMapRef.current.size
    let workPage = page
    while (selected < target && (workPage - 1) * rows < totalRecords) {
      let pageData: ArtworkApiRecord[]
      if (workPage === page) {
        pageData = records
      } else {
        const fetched = await fetchPageDataRaw(workPage, rows)
        if (!fetched) break
        pageData = fetched
      }
      for (const rec of pageData) {
        if (!selectionMapRef.current.has(rec.id)) {
          selectionMapRef.current.set(rec.id, rec)
          selected++
          if (selected >= target) break
        }
      }
      workPage++
    }
    setPageSelection(records.filter(r => selectionMapRef.current.has(r.id)))
    persistSelection()
  }

  const submitBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bulkCount) await bulkSelect(Math.min(bulkCount, totalRecords))
    bulkOverlayRef.current?.hide()
  }

  const clearAllSelections = () => {
    selectionMapRef.current.clear()
    setPageSelection([])
    persistSelection()
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
      <span>Total Selected Across Pages: {selectionMapRef.current.size}</span>
      <span>Current Page: {page}</span>
    </div>
  )

  const selectionHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        type="button"
        aria-label="Bulk Select"
        onClick={(e) => bulkOverlayRef.current?.toggle(e)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '50%',
          transition: 'background .2s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <img src={ChevronDown} alt="open bulk select" style={{ width: '1rem', height: '1rem', pointerEvents: 'none' }} />
      </button>
    </div>
  )

  return (
  <div className="card" style={{ textAlign: 'left', width: '100%', margin: '0 auto' }}>
      <h2>Art Institute Artworks</h2>
      <p style={{ marginTop: 0 }}>Server-side pagination with persistent multi-page row selection.</p>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'.5rem' }}>
        <Button type="button" label="Clear All Selections" size="small" severity="danger" outlined onClick={clearAllSelections} disabled={selectionMapRef.current.size===0} />
      </div>
      <DataTable
        value={records}
        dataKey="id"
        paginator
        lazy
        totalRecords={totalRecords}
        rows={rows}
        first={(page - 1) * rows}
        onPage={onPage}
        loading={loading}
        rowsPerPageOptions={[6,12,24,48]}
        selectionMode="multiple"
        selection={pageSelection}
        onSelectionChange={onSelectionChange}
        footer={footer}
        tableStyle={{ width: '100%', minWidth: '70rem', margin: '0 auto' }}
        emptyMessage={loading ? <span style={{ display:'flex', alignItems:'center', gap:'.5rem' }}><ProgressSpinner style={{ width: '25px', height: '25px' }} strokeWidth="8" /> Loading...</span> : 'No records'}
      >
        <Column selectionMode="multiple" header={selectionHeader} headerStyle={{ width: '5rem' }} style={{ width: '5rem' }} />
        <Column field="title" header="Title" style={{ minWidth: '16rem' }} />
        <Column field="place_of_origin" header="Origin" style={{ minWidth: '10rem' }} />
        <Column field="artist_display" header="Artist" style={{ minWidth: '18rem' }} />
        <Column field="inscriptions" header="Inscriptions" style={{ minWidth: '18rem' }} />
        <Column field="date_start" header="Start" style={{ width: '6rem' }} />
        <Column field="date_end" header="End" style={{ width: '6rem' }} />
      </DataTable>
      <OverlayPanel ref={bulkOverlayRef} dismissable showCloseIcon>
        <form onSubmit={submitBulk} style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', minWidth: '200px' }}>
          <span style={{ fontWeight: 600 }}>Select N Rows (across pages)</span>
          <InputNumber value={bulkCount} onValueChange={(e) => setBulkCount(e.value ?? null)} placeholder="Enter number" min={1} max={totalRecords} style={{ width: '100%' }} useGrouping={false} />
          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
            <Button type="button" label="Cancel" severity="secondary" onClick={() => { setBulkCount(null); bulkOverlayRef.current?.hide() }} />
            <Button type="submit" label="Apply" disabled={!bulkCount || bulkCount <= 0} />
          </div>
        </form>
      </OverlayPanel>
    </div>
  )
}

export default App
