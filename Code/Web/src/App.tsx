import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import './App.css'

type Zone = {
  id: string
  name: string
  crop: string
  moisture: number
  threshold: number
  method: string
  duration: number
  color: string
  x: number
  y: number
  width: number
  height: number
}

const initialZones: Zone[] = [
  { id: 'T0101', name: 'Cà chua', crop: 'Tomato bed', moisture: 72, threshold: 45, method: 'Tưới nhỏ giọt', duration: 8, color: '#e87c58', x: 82, y: 170, width: 218, height: 110 },
  { id: 'T0102', name: 'Rau thơm', crop: 'Herb garden', moisture: 58, threshold: 50, method: 'Phun sương', duration: 5, color: '#74b85a', x: 322, y: 100, width: 230, height: 115 },
  { id: 'T0103', name: 'Cải xanh (ESP32 Live)', crop: 'Leafy greens', moisture: 38, threshold: 55, method: 'Tưới nhỏ giọt', duration: 6, color: '#d6ad4d', x: 578, y: 168, width: 242, height: 110 },
  { id: 'T0104', name: 'Xà lách', crop: 'Lettuce bed', moisture: 64, threshold: 52, method: 'Phun sương', duration: 4, color: '#68a6b0', x: 170, y: 316, width: 258, height: 112 },
  { id: 'T0105', name: 'Bắp cải', crop: 'Cabbage bed', moisture: 49, threshold: 48, method: 'Tưới nhỏ giọt', duration: 7, color: '#8f79c7', x: 468, y: 314, width: 260, height: 112 },
]

const TOPIC_STATUS = 'smart-irrigation/status'
const TOPIC_CMD = 'smart-irrigation/cmd'

function Icon({ children }: { children: string }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function GardenMap({ zones, activeZone, onSelect, view }: { zones: Zone[]; activeZone: string; onSelect: (id: string) => void; view: '2d' | 'map' }) {
  return (
    <div className={`garden-map ${view === 'map' ? 'map-mode' : ''}`}>
      <svg viewBox="0 0 900 500" role="img" aria-label="Sơ đồ 2D khu vườn">
        <defs>
          <linearGradient id="soil" x1="0" x2="1">
            <stop offset="0" stopColor="#bb7a4d" />
            <stop offset="1" stopColor="#9b5b39" />
          </linearGradient>
          <pattern id="grass" width="36" height="36" patternUnits="userSpaceOnUse">
            <rect width="36" height="36" fill="#dff2d5" />
            <path d="M4 28l5-8m3 10 5-11m12 6 3-7M20 6l3 5" stroke="#c7e9bc" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x="15" y="15" width="870" height="470" rx="26" fill="url(#grass)" />
        <path d="M45 338 C180 290 215 270 360 295 S600 315 855 220" fill="none" stroke="#f8efd9" strokeWidth="34" opacity=".9" />
        <path d="M45 338 C180 290 215 270 360 295 S600 315 855 220" fill="none" stroke="#e9d8b0" strokeWidth="2" strokeDasharray="8 8" />
        <g className="solar-panel">
          <path d="M765 72l82 22-15 58-82-22z" fill="#397da5" stroke="#20546d" strokeWidth="4" />
          <path d="M777 77l-14 54m39-48-14 58m39-49-14 57M754 101l82 22m-86-1 82 22" stroke="#bce6ed" strokeWidth="2" />
          <path d="M796 150v40m-20 0h42" stroke="#77848a" strokeWidth="5" />
        </g>
        {zones.map((zone) => {
          const selected = zone.id === activeZone
          return (
            <g key={zone.id} className={`garden-zone ${selected ? 'selected' : ''}`} onClick={() => onSelect(zone.id)}>
              <rect x={zone.x + 8} y={zone.y + 9} width={zone.width} height={zone.height} rx="10" fill="#754630" opacity=".22" />
              <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="10" fill="url(#soil)" stroke={selected ? '#123e34' : '#855137'} strokeWidth={selected ? 5 : 3} />
              <path d={`M${zone.x + 22} ${zone.y + 28}h${zone.width - 44}M${zone.x + 22} ${zone.y + 56}h${zone.width - 44}M${zone.x + 22} ${zone.y + 84}h${zone.width - 44}`} stroke="#6e3c28" strokeWidth="4" opacity=".7" />
              {[...Array(7)].map((_, index) => (
                <circle key={index} cx={zone.x + 30 + (index % 4) * ((zone.width - 65) / 3)} cy={zone.y + 35 + Math.floor(index / 4) * 47} r="10" fill={zone.color} opacity=".95" />
              ))}
              <text x={zone.x + 15} y={zone.y - 12} fill="#315445" fontSize="13" fontWeight="700">{zone.id}</text>
              {selected && <circle cx={zone.x + zone.width - 18} cy={zone.y + 18} r="8" fill="#1eae72" stroke="#fff" strokeWidth="3" />}
            </g>
          )
        })}
        <g className="water-tank">
          <rect x="44" y="72" width="57" height="74" rx="14" fill="#9bd1d7" stroke="#4a8f99" strokeWidth="3" />
          <path d="M53 109h39v27H53z" fill="#4aabb4" opacity=".75" />
          <path d="M44 88h57" stroke="#4a8f99" strokeWidth="3" />
          <text x="35" y="167" fill="#315445" fontSize="12" fontWeight="700">WATER TANK</text>
        </g>
        <g className="sensor-pin" transform="translate(560 130)">
          <circle r="12" fill="#fff" stroke="#1eae72" strokeWidth="4" />
          <circle r="4" fill="#1eae72" />
        </g>
      </svg>
      <div className="map-legend"><span><i className="dot green" /> Sensor online</span><span><i className="dot amber" /> Needs attention</span><span><i className="line" /> Irrigation path</span></div>
    </div>
  )
}

function App() {
  const [zones, setZones] = useState(initialZones)
  const [activeZone, setActiveZone] = useState('T0103') // T0103 đại diện zone kết nối ESP32
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [pumpOn, setPumpOn] = useState(false)
  const [temperature, setTemperature] = useState(25.0)
  const [humidity, setHumidity] = useState(65.0)
  const [rainBlock, setRainBlock] = useState(false)
  const [view, setView] = useState<'2d' | 'map'>('2d')
  const [syncing, setSyncing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('Chưa kết nối')
  const [logs, setLogs] = useState<string[]>([
    'Mosquitto Broker: ws://localhost:9001',
    'Chờ nhận dữ liệu từ ESP32 Wokwi...'
  ])
  
  const clientRef = useRef<ReturnType<typeof mqtt.connect> | null>(null)
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0]

  // ================= KẾT NỐI MQTT MOSQUITTO =================
  useEffect(() => {
    // Kết nối Mosquitto qua WebSockets cổng 9001
    const client = mqtt.connect('ws://localhost:9001', {
      reconnectPeriod: 2000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      setLastUpdated('Vừa kết nối')
      setLogs((current) => [`Web đã kết nối Mosquitto Broker thành công!`, ...current])
      client.subscribe(TOPIC_STATUS)
    })

    client.on('message', (topic, message) => {
      if (topic === TOPIC_STATUS) {
        try {
          const data = JSON.parse(message.toString())
          // data format: { moisture, temperature, humidity, pump, mode }
          if (data.moisture !== undefined) {
            setZones((current) =>
              current.map((z) => (z.id === 'T0103' ? { ...z, moisture: data.moisture } : z))
            )
          }
          if (data.temperature !== undefined) setTemperature(data.temperature)
          if (data.humidity !== undefined) setHumidity(data.humidity)
          if (data.pump !== undefined) setPumpOn(Boolean(data.pump))
          if (data.mode !== undefined) setMode(data.mode === 'auto' ? 'auto' : 'manual')

          const time = new Date().toLocaleTimeString()
          setLastUpdated(time)
        } catch (e) {
          console.error('Lỗi phân tích JSON từ MQTT:', e)
        }
      }
    })

    client.on('close', () => {
      setConnected(false)
    })

    client.on('error', (err) => {
      console.error('Mosquitto error:', err)
      setConnected(false)
    })

    return () => {
      client.end()
    }
  }, [])

  // ================= ĐIỀU KHIỂN BƠM =================
  const togglePump = () => {
    if (!connected || !clientRef.current) {
      setLogs((current) => [`Không thể điều khiển khi mất kết nối MQTT`, ...current])
      return
    }
    const nextState = !pumpOn
    setPumpOn(nextState)
    const cmd = nextState ? 'PUMP_ON' : 'PUMP_OFF'
    clientRef.current.publish(TOPIC_CMD, cmd)
    setLogs((current) => [`Gửi lệnh: ${cmd} (${mode === 'manual' ? 'Thủ công' : 'Bảng điều khiển'})`, ...current])
  }

  // ================= ĐỔI CHẾ ĐỘ =================
  const changeMode = (newMode: 'auto' | 'manual') => {
    setMode(newMode)
    if (clientRef.current && connected) {
      const cmd = newMode === 'auto' ? 'MODE_AUTO' : 'MODE_MANUAL'
      clientRef.current.publish(TOPIC_CMD, cmd)
      setLogs((current) => [`Chuyển sang chế độ: ${newMode.toUpperCase()}`, ...current])
    }
  }

  const toggleIrrigation = () => {
    if (!connected || !clientRef.current) {
      setLogs((current) => [`Mất kết nối thiết bị!`, ...current])
      return
    }
    changeMode('manual')
    togglePump()
  }

  const syncLiveData = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setLogs((current) => [`Đã gửi yêu cầu đồng bộ cảm biến`, ...current])
    }, 500)
  }

  const changeThreshold = (value: number) => {
    setZones((current) => current.map((zone) => zone.id === activeZone ? { ...zone, threshold: value } : zone))
    setLogs((current) => [`Đổi ngưỡng tưới ${activeZone} thành ${value}%`, ...current])
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">✦</span><span>Green<span>flow</span></span></div>
        <nav>
          <p className="nav-label">WORKSPACE</p>
          <button className="nav-item active"><Icon>⌂</Icon>Overview</button>
          <button className="nav-item"><Icon>▦</Icon>Garden layout</button>
          <button className="nav-item"><Icon>⌁</Icon>Live sensors</button>
          <button className="nav-item"><Icon>◴</Icon>Automation</button>
          <p className="nav-label second">SYSTEM</p>
          <button className="nav-item"><Icon>◉</Icon>Mosquitto MQTT <span className="nav-status" /></button>
          <button className="nav-item"><Icon>⚙</Icon>Settings</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><div className="connection-title"><span className={`pulse ${connected ? '' : 'off'}`} /> {connected ? 'Mosquitto Connected' : 'Mosquitto Offline'}</div><small>ESP32 · Cập nhật: {lastUpdated}</small><button onClick={() => setConnected(!connected)}>{connected ? 'Disconnect' : 'Connect device'}</button></div>
          <div className="profile"><div className="avatar">AT</div><div><strong>Anna Tran</strong><small>Garden owner</small></div><span>•••</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark">✦</span> Greenflow</div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♢<i /></button><div className="mini-avatar">AT</div></div></header>
        <div className="page-heading"><div><p className="eyebrow">HỆ THỐNG TƯỚI TỰ ĐỘNG THÔNG MINH</p><h1>Dashboard Giám Sát Realtime <span>✦</span></h1><p className="subtitle">Kết nối trực tiếp ESP32 Wokwi qua Mosquitto MQTT Broker.</p></div><button className="sync-button" onClick={syncLiveData} disabled={syncing}><span>↻</span> {syncing ? 'Syncing...' : 'Sync live data'}</button></div>
        {!connected && <div className="offline-banner"><span>!</span><div><strong>Mosquitto Broker chưa kết nối</strong><small>Hãy chắc chắn mosquitto.exe đang chạy trên máy (cổng 9001).</small></div><button onClick={syncLiveData}>Reconnect</button></div>}

        <section className="garden-panel panel">
          <div className="panel-heading"><div><h2>Garden overview</h2><p>Vùng <strong>T0103</strong> được liên kết trực tiếp với cảm biến ESP32</p></div><div className="view-switch"><button className={view === '2d' ? 'selected' : ''} onClick={() => setView('2d')}>2D view</button><button className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}>Map</button></div></div>
          <GardenMap zones={zones} activeZone={activeZone} onSelect={setActiveZone} view={view} />
          <div className="selected-zone"><div className="zone-title"><span className="status-dot" /> <strong>{selectedZone.id}</strong> · {selectedZone.name}<small>{selectedZone.crop}</small></div><div className="zone-stat"><span>Độ ẩm đất</span><strong>{selectedZone.moisture}%</strong><div className="progress"><i style={{ width: `${selectedZone.moisture}%` }} /></div></div><div className="zone-stat"><span>Ngưỡng kích hoạt</span><strong>{selectedZone.threshold}% <em>{selectedZone.moisture < selectedZone.threshold ? 'Cần tưới nước' : 'Độ ẩm tốt'}</em></strong></div><button className={`water-button ${pumpOn ? 'watering' : ''}`} onClick={toggleIrrigation}>{pumpOn ? '◌ Bơm đang chạy...' : '♧ Tưới khu vực này'}</button></div>
        </section>

        <section className="control-grid">
          <article className="panel control-card"><div className="panel-heading"><div><h2>Điều khiển Bơm</h2><p>Tự động theo thuật toán Hysteresis (40% - 60%)</p></div><span className={`live-badge ${pumpOn ? 'active' : ''}`}><i /> {pumpOn ? 'Máy bơm ĐANG BẬT' : 'Máy bơm ĐANG TẮT'}</span></div><div className="mode-row"><span>Chế độ vận hành</span><div className="mode-switch"><button className={mode === 'auto' ? 'selected' : ''} onClick={() => changeMode('auto')}>Automatic</button><button className={mode === 'manual' ? 'selected' : ''} onClick={() => changeMode('manual')}>Manual</button></div></div><div className="control-row"><div><strong>{mode === 'auto' ? 'Chế độ Tự động (Auto)' : 'Chế độ Thủ công (Manual)'}</strong><small>{mode === 'auto' ? `ESP32 tự bật khi < 40%, tắt khi > 60%` : 'Bạn có thể bật/tắt bơm tự do bằng công tắc bên cạnh'}</small></div><button aria-label="Toggle pump" className={`big-toggle ${pumpOn ? 'on' : ''}`} onClick={togglePump}><i /></button></div><div className="threshold-control"><label htmlFor="threshold">Ngưỡng đất khô <strong>{selectedZone.threshold}%</strong></label><input id="threshold" type="range" min="20" max="80" value={selectedZone.threshold} onChange={(event) => changeThreshold(Number(event.target.value))} /><div><span>20% Khô</span><span>80% Ẩm</span></div></div></article>
          <article className="panel weather-card"><div className="panel-heading"><div><h2>Cảm biến DHT22</h2><p>Nhiệt độ & Độ ẩm môi trường</p></div><span className="weather-icon">⛅</span></div><div className="weather-main"><strong>{temperature}°</strong><span>°C · {humidity}% độ ẩm</span></div><div className="weather-details"><span><b>☁</b> Trạng thái</span><strong>{temperature > 32 ? 'Nắng nóng' : 'Ổn định'}</strong></div><div className="weather-details"><span><b>≋</b> MQTT Topic</span><strong>smart-irrigation/status</strong></div><label className="check-row"><input type="checkbox" checked={rainBlock} onChange={(event) => setRainBlock(event.target.checked)} /><span>Hoãn tưới nếu có mưa</span></label><div className="weather-alert">{rainBlock ? '● Đang bật bảo vệ thời tiết' : '○ Weather gate đang tắt'}</div></article>
          <article className="panel profile-card"><div className="panel-heading"><div><h2>Hồ sơ cây trồng</h2><p>Khuyến nghị cho {selectedZone.name}</p></div><button className="dots">•••</button></div><div className="plant-name"><span className="plant-emoji">🌿</span><div><strong>{selectedZone.name}</strong><small>Nhu cầu nước: trung bình</small></div></div><div className="profile-line"><span>Phương pháp</span><strong>{selectedZone.method}</strong></div><div className="profile-line"><span>Thời lượng mỗi lần</span><strong>{selectedZone.duration} phút</strong></div><div className="recommendation">✦ <span>Độ ẩm hiện tại: {selectedZone.moisture}%. Hệ thống duy trì ổn định qua rơ-le & servo ESP32.</span></div></article>
        </section>

        <div className="section-title"><h2>Thông số thời gian thực</h2><button className="link-button">Chi tiết cảm biến →</button></div>
        <section className="metrics-grid">
          <article className="metric-card"><div className="metric-icon orange">☼</div><span>Nhiệt độ không khí</span><strong>{temperature}°<small>C</small></strong><p>Đọc từ DHT22 ESP32</p></article>
          <article className="metric-card"><div className="metric-icon blue">≋</div><span>Độ ẩm không khí</span><strong>{humidity}% <small className="good">● DHT22</small></strong><p>Thời tiết nhà vườn</p></article>
          <article className="metric-card"><div className="metric-icon green">♧</div><span>Độ ẩm đất (Zone T0103)</span><strong>{zones.find((z) => z.id === 'T0103')?.moisture}% <small className={pumpOn ? 'good' : 'warning'}>{pumpOn ? '● Đang tưới' : '● Bình thường'}</small></strong><p>Đọc từ biến trở đất (GPIO 34)</p></article>
          <article className="metric-card resource-card"><div className="resource-row"><span><b className="resource-icon blue">♒</b> Trạng thái Rơ-le</span><strong>{pumpOn ? 'BẬT (Active)' : 'TẮT (Idle)'}</strong></div><div className="resource-progress"><i className="blue-fill" style={{ width: pumpOn ? '100%' : '0%' }} /></div><div className="resource-row"><span><b className="resource-icon purple">✥</b> Góc mở van Servo</span><strong>{pumpOn ? '90 độ' : '0 độ'}</strong></div><div className="resource-progress"><i className="purple-fill" style={{ width: pumpOn ? '100%' : '0%' }} /></div></article>
          <article className="metric-card resource-card"><div className="resource-row"><span><b className="resource-icon pink">✿</b> Chế độ tưới</span><strong>{mode.toUpperCase()}</strong></div><div className="resource-progress"><i className="pink-fill" /></div><div className="resource-row"><span><b className="resource-icon orange">◌</b> Cổng WebSocket</span><strong>9001 (Mosquitto)</strong></div><div className="resource-progress"><i className="orange-fill" /></div></article>
        </section>

        <section className="below-grid"><article className="panel activity-card"><div className="panel-heading"><div><h2>Nhật ký MQTT Events</h2><p>Lịch sử truyền nhận dữ liệu</p></div><button className="link-button" onClick={() => setLogs([])}>Xóa log</button></div><div className="activity-list">{logs.length ? logs.slice(0, 5).map((log, index) => <div className="activity-item" key={index}><i />{log}</div>) : <div className="empty-state">Chưa có sự kiện mới.</div>}</div></article><article className="panel zone-summary"><div className="panel-heading"><div><h2>Tình trạng các khu vực</h2><p>Chỉ số độ ẩm đất toàn vườn</p></div><span className="healthy-count">{zones.filter((zone) => zone.moisture >= zone.threshold).length}/{zones.length} Đạt chuẩn</span></div>{zones.map((zone) => <button className="zone-row" key={zone.id} onClick={() => setActiveZone(zone.id)}><span className="zone-color" style={{ background: zone.color }} /><strong>{zone.id}</strong><span>{zone.name}</span><div className="mini-bar"><i style={{ width: `${zone.moisture}%` }} /></div><b className={zone.moisture < zone.threshold ? 'dry' : ''}>{zone.moisture}%</b></button>)}</article></section>
      </section>
    </main>
  )
}

export default App
