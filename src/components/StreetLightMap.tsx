import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { StreetLightData, StreetLightLocation, RepairRecord } from '../types';
import { SHEET_URL, CHECK_SHEET_URL, DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants';
import { Search, AlertTriangle, Info, ExternalLink, X, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Fix for Leaflet default icon issues in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'unrepaired-marker'
});

function parseTaiwanDateTime(twStr: string) {
  if (!twStr) return null;
  const parts = twStr.trim().split(' ');
  if (parts.length < 3) return null;
  const [datePart, ampm, timePart] = parts;
  const [year, month, day] = datePart.split('/').map(Number);
  let [hour, minute, second] = timePart.split(':').map(Number);
  if (ampm === '下午' && hour < 12) hour += 12;
  if (ampm === '上午' && hour === 12) hour = 0;
  return new Date(year, month - 1, day, hour, minute, second);
}

// Component to handle map actions like flying to a location
const MapController = ({ target }: { target: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 18, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
};

export default function StreetLightMap() {
  const [lights, setLights] = useState<StreetLightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [targetLocation, setTargetLocation] = useState<[number, number] | null>(null);
  const [showTooltips, setShowTooltips] = useState(true);
  const [unrepairedListOpen, setUnrepairedListOpen] = useState(true);

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [locationRes, repairRes] = await Promise.all([
          fetch(SHEET_URL).then(res => res.json()),
          fetch(CHECK_SHEET_URL).then(res => res.json())
        ]);

        const unrepairedSet = new Set<string>();
        const reportTimeMap = new Map<string, Date>();
        const faultMap = new Map<string, string>();

        repairRes.forEach((row: RepairRecord) => {
          const lampID = row["路燈編號"]?.trim();
          const reportTimeStr = row["通報時間"]?.trim();
          const status = (row["維修情形"] || "").trim();
          const fault = (row["故障情形"] || "").trim();

          if (lampID) {
            if (status === "未查修") {
              unrepairedSet.add(lampID);
              const reportDate = parseTaiwanDateTime(reportTimeStr);
              if (reportDate && !isNaN(reportDate.getTime())) {
                reportTimeMap.set(lampID, reportDate);
              }
            }
            faultMap.set(lampID, fault);
          }
        });

        const processedLights: StreetLightData[] = locationRes
          .map((row: StreetLightLocation) => {
            const id = row["原路燈號碼"]?.trim();
            const lat = parseFloat(row["緯度Latitude"]);
            const lng = parseFloat(row["經度Longitude"]);

            if (!id || isNaN(lat) || isNaN(lng)) return null;

            return {
              ...row,
              id,
              lat,
              lng,
              isUnrepaired: unrepairedSet.has(id),
              fault: faultMap.get(id) || "",
              reportDate: reportTimeMap.get(id)
            };
          })
          .filter(Boolean) as StreetLightData[];

        setLights(processedLights);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const unrepairedLights = useMemo(() =>
    lights.filter(l => l.isUnrepaired),
    [lights]);

  const repairedLights = useMemo(() =>
    lights.filter(l => !l.isUnrepaired),
    [lights]);

  const handleSearch = () => {
    const light = lights.find(l => l.id === searchId);
    if (light) {
      setTargetLocation([light.lat, light.lng]);
    } else {
      alert("查無此路燈編號！");
    }
  };

  const getReportDiffText = (reportDate?: Date) => {
    if (!reportDate) return "無通報時間";
    const now = new Date();
    const diffMs = now.getTime() - reportDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const daysPart = Math.floor(diffDays);
    const hoursPart = Math.floor((diffMs - daysPart * 24 * 60 * 60 * 1000) / (1000 * 60 * 60));

    let symbol = "🔵";
    if (diffDays >= 7) symbol = "🆘";
    else if (diffDays >= 3) symbol = "⚠️";
    else if (diffDays >= 1) symbol = "🟡";

    return `報修 ${daysPart}天${hoursPart}時 ${symbol}`;
  };

  const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    let size = "small";
    if (count >= 50) size = "large";
    else if (count >= 20) size = "medium";

    return L.divIcon({
      html: `<div class="cluster-icon ${size}">${count}</div>`,
      className: 'custom-cluster',
      iconSize: L.point(40, 40)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">載入地圖數據中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden font-sans">
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xs px-2 sm:px-0">
        <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl p-2 flex items-center border border-white/20">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="輸入5碼路燈編號"
            className="flex-1 px-3 py-2 bg-transparent outline-none text-slate-700 text-sm"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            查詢
          </button>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((position) => {
                setTargetLocation([position.coords.latitude, position.coords.longitude]);
              });
            }
          }}
          className="bg-white/90 backdrop-blur shadow-md rounded-xl p-2 text-slate-700 border border-white/20 hover:bg-white transition-all flex items-center justify-center"
          title="我的位置"
        >
          <Navigation className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowTooltips(!showTooltips)}
          className="bg-white/90 backdrop-blur shadow-md rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 border border-white/20 hover:bg-white transition-all flex items-center gap-2"
        >
          <Info className="w-4 h-4" />
          {showTooltips ? "隱藏編號" : "顯示編號"}
        </button>

        <div className="bg-white/90 backdrop-blur shadow-md rounded-xl px-4 py-2 text-xs font-bold text-red-600 border border-white/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          未查修：{unrepairedLights.length}
        </div>
      </div>

      {/* Unrepaired List Toggle */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          onClick={() => setUnrepairedListOpen(!unrepairedListOpen)}
          className="bg-indigo-600 text-white shadow-lg rounded-2xl px-5 py-3 text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
        >
          <AlertTriangle className="w-4 h-4" />
          未查修清單
        </button>
      </div>

      {/* Unrepaired List Panel */}
      <AnimatePresence>
        {unrepairedListOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 left-4 z-[1000] w-72 max-h-[60vh] bg-white/95 backdrop-blur-md shadow-2xl rounded-3xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                未查修清單 ({unrepairedLights.length})
              </h3>
              <button onClick={() => setUnrepairedListOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {unrepairedLights.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm italic">目前無未查修項目</p>
              ) : (
                <ul className="space-y-1">
                  {unrepairedLights.map(light => (
                    <li key={light.id} className="group">
                      <button
                        onClick={() => {
                          setTargetLocation([light.lat, light.lng]);
                          setUnrepairedListOpen(false);
                        }}
                        className="w-full text-left p-3 rounded-2xl hover:bg-indigo-50 transition-colors flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-600">{light.id}</span>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">點擊定位</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          {getReportDiffText(light.reportDate)}
                        </div>
                        {light.fault && (
                          <div className="text-[10px] text-red-500 font-medium mt-1 line-clamp-1">
                            故障：{light.fault}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Button */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <button
          onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfWGZHxdMKfLZFyTVpaVU8oCW45KhCP5XzhmJn6StAW2_uIlA/viewform', '_blank')}
          className="bg-emerald-600 text-white shadow-lg rounded-2xl px-5 py-3 text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all"
        >
          <Info className="w-4 h-4" />
          路燈通報系統
        </button>
        <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-lg text-[10px] text-slate-500 font-medium shadow-sm border border-white/20">
          02/25/2026 W.K Design
        </div>
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full z-0"
        maxZoom={22}
        // @ts-ignore
        ref={mapRef}
      >
        <MapController target={targetLocation} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="街道地圖 (OSM)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="衛星地圖 (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={18}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="地形圖 (OpenTopoMap)">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxNativeZoom={17}
              maxZoom={22}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Unrepaired Markers (Not Clustered, Blinking) */}
        {unrepairedLights.map(light => (
          <Marker
            key={light.id}
            position={[light.lat, light.lng]}
            icon={redIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="p-1 min-w-[150px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">⚠️ 未查修</span>
                  <span className="font-bold text-slate-800">#{light.id}</span>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <p><span className="font-semibold">故障情形：</span>{light.fault || "未註明"}</p>
                  <p><span className="font-semibold">通報狀態：</span>{getReportDiffText(light.reportDate)}</p>
                  <a
                    href={`https://www.google.com/maps?q=&layer=c&cbll=${light.lat},${light.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold transition-colors mt-3"
                  >
                    <ExternalLink className="w-3 h-3" />
                    查看街景
                  </a>
                </div>
              </div>
            </Popup>
            {showTooltips && (
              <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.9}>
                {light.id}
              </Tooltip>
            )}
          </Marker>
        ))}

        {/* Repaired Markers (Clustered) */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={50}
        >
          {repairedLights.map(light => (
            <Marker
              key={light.id}
              position={[light.lat, light.lng]}
            >
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-full">✓ 已查修</span>
                    <span className="font-bold text-slate-800">#{light.id}</span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    <a
                      href={`https://www.google.com/maps?q=&layer=c&cbll=${light.lat},${light.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold transition-colors mt-3"
                    >
                      <ExternalLink className="w-3 h-3" />
                      查看街景
                    </a>
                  </div>
                </div>
              </Popup>
              {showTooltips && (
                <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.9}>
                  {light.id}
                </Tooltip>
              )}
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

