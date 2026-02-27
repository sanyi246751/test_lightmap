import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Search, CheckCircle, Crosshair, RefreshCw, History, Save, Undo2, Trash2, ArrowRight, Clock, Image as ImageIcon, Camera, ExternalLink, X, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StreetLightData, HistoryRecord } from '../types';
import { HISTORY_SHEET_URL, GAS_WEB_APP_URL } from '../constants';

const formatCoord = (val: string | number) => {
    if (!val) return "";
    const num = Number(val);
    if (isNaN(num)) return String(val).slice(0, 10); // fallback
    return num.toFixed(5);
};

interface ReplaceLightViewProps {
    lights: StreetLightData[];
    villageData: any;
    onBack: () => void;
}

const VILLAGE_CODES: Record<string, string> = {
    "廣盛村": "01",
    "雙湖村": "02",
    "雙潭村": "03",
    "勝興村": "04",
    "西湖村": "05",
    "龍騰村": "06",
    "鯉魚潭村": "07"
};

export default function ReplaceLightView({ lights, villageData, onBack }: ReplaceLightViewProps) {
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');

    // Detailed Geolocation Info
    const [locationInfo, setLocationInfo] = useState<{ lat: string; lng: string; time: string } | null>(null);
    const [detectedVillage, setDetectedVillage] = useState<string | null>(null);
    const [manualVillage, setManualVillage] = useState<string>('');

    // History State
    const [history, setHistory] = useState<any[]>([]);

    // Edit State
    const [searchId, setSearchId] = useState('');
    const [foundLight, setFoundLight] = useState<StreetLightData | null>(null);
    const [searchEdit, setSearchEdit] = useState({ lat: '', lng: '' });
    const [newLightId, setNewLightId] = useState('');
    const [newLightEdit, setNewLightEdit] = useState({ lat: '', lng: '' });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<Set<number>>(new Set());

    const [showConfirm, setShowConfirm] = useState<{ type: 'search' | 'new', id: string, lat: string, lng: string } | null>(null);

    // Point in Polygon Detection
    const isPointInPolygon = (lat: number, lng: number, polygon: any) => {
        let inside = false;
        const coords = polygon[0];
        for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
            const xi = coords[i][0], yi = coords[i][1];
            const xj = coords[j][0], yj = coords[j][1];
            const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const detectVillage = (lat: number, lng: number) => {
        if (!villageData || !villageData.features) return null;
        for (const feature of villageData.features) {
            const geometry = feature.geometry;
            const name = feature.properties.VILLNAME;
            if (geometry.type === 'Polygon') {
                if (isPointInPolygon(lat, lng, geometry.coordinates)) return name;
            } else if (geometry.type === 'MultiPolygon') {
                for (const polygon of geometry.coordinates) {
                    if (isPointInPolygon(lat, lng, polygon)) return name;
                }
            }
        }
        return null;
    };

    const getNextId = (vName: string) => {
        const vCode = VILLAGE_CODES[vName];
        if (!vCode) return '';
        // Find all lights in this village
        const villageLights = lights.filter(l => l.id.startsWith(vCode));
        if (villageLights.length === 0) return `${vCode}001`;

        // Extract numbers and find max
        const nums = villageLights.map(l => {
            const n = parseInt(l.id);
            return isNaN(n) ? 0 : n;
        }).filter(n => n > 0);

        const maxNum = nums.length > 0 ? Math.max(...nums) : parseInt(vCode + "000");
        return (maxNum + 1).toString().padStart(5, '0');
    };

    useEffect(() => {
        const v = manualVillage || detectedVillage;
        if (v) {
            const next = getNextId(v);
            setNewLightId(next);
        } else {
            setNewLightId('');
        }
    }, [manualVillage, detectedVillage]);

    useEffect(() => {
        fetchHistory();
        getDeviceLocation(); // 進入系統預先定位
    }, []);

    const fetchHistory = async () => {
        try {
            // 使用 GAS 直連獲取最新紀錄，避開 OpenSheet 快取問題
            const res = await fetch(`${GAS_WEB_APP_URL || ''}?t = ${Date.now()} `);
            const data = await res.json();
            console.log("History Data from GAS:", data);

            if (Array.isArray(data)) {
                setHistory(data); // GAS 端已經 reverse 過了，最新的在前
            } else {
                console.error("History data is not an array:", data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    const getDeviceLocation = (callback?: (lat: number, lng: number) => void) => {
        setLoading(true);
        if (!navigator.geolocation) {
            alert("您的瀏覽器不支持定位功能");
            setLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} `;

                setLocationInfo({
                    lat: latitude.toFixed(5),
                    lng: longitude.toFixed(5),
                    time: timeStr
                });

                setLoading(false);
                const village = detectVillage(latitude, longitude);
                setDetectedVillage(village);
                if (village) setManualVillage(village);

                if (callback) callback(latitude, longitude);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("無法獲獲取位置資訊，請確認 GPS 已開啟並且網頁有定位授權。");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };


    const handleSearchId = () => {
        const light = lights.find(l => l.id === searchId.trim());
        if (light) {
            setFoundLight(light);
            setSearchEdit({ lat: light.lat.toString(), lng: light.lng.toString() });
        } else {
            alert("查無此路燈編號");
            setFoundLight(null);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'camera' | 'file') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingImage(true);
        try {
            // Read as DataURL for preview and upload
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            setSelectedImage(base64);

            // If it's a file upload, try to extract EXIF GPS
            if (mode === 'file') {
                const arrayBuffer = await file.arrayBuffer();
                const coords = extractGPSSimplified(arrayBuffer);
                if (coords) {
                    setNewLightEdit({ lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) });
                    alert("成功從照片 EXIF 提取座標！");
                }
            }
        } catch (err) {
            console.error("Image processing error:", err);
        } finally {
            setIsProcessingImage(false);
            e.target.value = ''; // Reset input
        }
    };

    const extractGPSSimplified = (buffer: ArrayBuffer) => {
        const dv = new DataView(buffer);
        if (dv.getUint16(0) !== 0xFFD8) return null; // Not a JPEG

        let offset = 2;
        while (offset < dv.byteLength) {
            if (dv.getUint16(offset) === 0xFFE1) {
                // Found APP1 (EXIF)
                const exifData = parseExif(dv, offset + 4);
                return exifData;
            }
            offset += 2 + dv.getUint16(offset + 2);
        }
        return null;
    };

    const parseExif = (dv: DataView, offset: number) => {
        // Very basic EXIF GPS parser
        // Check for "Exif\0\0"
        if (dv.getUint32(offset) !== 0x45786966) return null;

        const littleEndian = dv.getUint16(offset + 6) === 0x4949;
        const ifd0Offset = dv.getUint32(offset + 10, littleEndian);

        function getGPS(ifdOffset: number): { lat: number, lng: number } | null {
            const numEntries = dv.getUint16(offset + 6 + ifdOffset, littleEndian);
            let gpsIFDOffset = -1;

            for (let i = 0; i < numEntries; i++) {
                const entryOffset = offset + 6 + ifdOffset + 2 + i * 12;
                const tag = dv.getUint16(entryOffset, littleEndian);
                if (tag === 0x8825) { // GPS Info tag
                    gpsIFDOffset = dv.getUint32(entryOffset + 8, littleEndian);
                    break;
                }
            }

            if (gpsIFDOffset === -1) return null;

            const gpsEntries = dv.getUint16(offset + 6 + gpsIFDOffset, littleEndian);
            let lat, lng, latRef = 'N', lngRef = 'E';

            for (let i = 0; i < gpsEntries; i++) {
                const entryOffset = offset + 6 + gpsIFDOffset + 2 + i * 12;
                const tag = dv.getUint16(entryOffset, littleEndian);
                const subOffset = dv.getUint32(entryOffset + 8, littleEndian) + offset + 6;

                const getRational = (off: number) => dv.getUint32(off, littleEndian) / dv.getUint32(off + 4, littleEndian);

                if (tag === 1) latRef = String.fromCharCode(dv.getUint8(entryOffset + 8)) === 'S' ? 'S' : 'N';
                if (tag === 2) lat = getRational(subOffset) + getRational(subOffset + 8) / 60 + getRational(subOffset + 16) / 3600;
                if (tag === 3) lngRef = String.fromCharCode(dv.getUint8(entryOffset + 8)) === 'W' ? 'W' : 'E';
                if (tag === 4) lng = getRational(subOffset) + getRational(subOffset + 8) / 60 + getRational(subOffset + 16) / 3600;
            }

            if (lat !== undefined && lng !== undefined) {
                return {
                    lat: latRef === 'S' ? -lat : lat,
                    lng: lngRef === 'W' ? -lng : lng
                };
            }
            return null;
        }

        return getGPS(ifd0Offset);
    };

    const handleSave = async (id: string, lat: string, lng: string, options?: { villageCode?: string, action?: string, beforeLat?: string, beforeLng?: string, time?: string, image?: string }) => {
        if (!GAS_WEB_APP_URL) {
            alert("尚未設定 GAS URL");
            return;
        }

        setIsSaving(true);
        const currentLight = lights.find(l => l.id === id);
        const payload = {
            id,
            lat,
            lng,
            beforeLat: options?.beforeLat || currentLight?.lat.toString() || "",
            beforeLng: options?.beforeLng || currentLight?.lng.toString() || "",
            villageCode: options?.villageCode,
            villageName: manualVillage || detectedVillage,
            action: options?.action || (options?.villageCode ? "new" : "update"),
            time: options?.time,
            image: options?.image || selectedImage
        };

        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Clean up state after successful dispatch
            setSelectedImage(null);
            setFoundLight(null);
            setSearchId('');
            setSearchEdit({ lat: '', lng: '' });

            if (payload.action === 'new') {
                setNewLightId('');
                setNewLightEdit({ lat: '', lng: '' });
                setDetectedVillage(null);
                setManualVillage('');
            }

            setShowConfirm(null);
            alert("✅ 資料已同步！請稍候數秒讓 Google Sheet 完成處理。");
            fetchHistory(); // Refresh history
        } catch (error) {
            console.error("Save error:", error);
            alert("儲存失敗，請檢查網路連線或 GAS 設定。");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBatchDelete = async () => {
        if (!selectedHistory.size) return;
        if (!confirm(`確定要刪除選中的 ${selectedHistory.size} 筆紀錄嗎？`)) return;

        setIsSaving(true);
        const items = Array.from(selectedHistory).map(idx => {
            const h = history[idx];
            return { id: h.路燈編號, time: h.修改時間 || h.時間 };
        });

        try {
            await fetch(GAS_WEB_APP_URL || '', {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'batchDelete', items })
            });
            alert("多筆紀錄刪除成功！");
            setSelectedHistory(new Set());
            fetchHistory();
        } catch (err) {
            console.error(err);
            alert("刪除失敗");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSelect = (idx: number) => {
        const next = new Set(selectedHistory);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedHistory(next);
    };

    const toggleSelectAll = () => {
        if (selectedHistory.size === history.length) {
            setSelectedHistory(new Set());
        } else {
            setSelectedHistory(new Set(history.map((_, i) => i)));
        }
    };

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight">資料置換系統</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {locationInfo ? (
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-1 text-[10px] text-indigo-600 font-bold">
                                    <MapPin className="w-3 h-3" /> 已定位
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                    {locationInfo.time} | {locationInfo.lat}, {locationInfo.lng}
                                </div>
                            </div>
                        ) : (
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-bold">
                                    <MapPin className="w-3 h-3 opacity-30" /> 未定位
                                </div>
                            </div>
                        )}
                        <button onClick={() => getDeviceLocation()} className={`p-3 rounded-2xl transition-all ${locationInfo ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'} hover:scale-105 active:scale-95`}>
                            <Crosshair className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl relative shadow-inner">
                    <div className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ${activeTab === 'history' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} />
                    <button onClick={() => setActiveTab('edit')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold z-10 transition-colors ${activeTab === 'edit' ? 'text-indigo-600' : 'text-slate-500'}`}>
                        <RefreshCw className="w-3.5 h-3.5" /> 編輯資料
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold z-10 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500'}`}>
                        <History className="w-3.5 h-3.5" /> 歷史紀錄
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-16">
                <AnimatePresence mode="wait">
                    {activeTab === 'edit' ? (
                        <motion.div key="edit" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">

                            {/* ID Search Section */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 px-1"><Search className="w-4 h-4 text-emerald-500" /> 搜尋路燈編號</h2>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="輸入編號..." className="flex-1 px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchId()} />
                                    <button onClick={handleSearchId} className="bg-emerald-600 text-white px-4 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">搜尋</button>
                                </div>

                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <div className="grid grid-cols-2 gap-2 flex-1">
                                            <input type="text" value={searchEdit.lat} onChange={e => setSearchEdit({ ...searchEdit, lat: e.target.value })} className="px-3 py-2.5 bg-slate-50 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20" placeholder="緯度" />
                                            <input type="text" value={searchEdit.lng} onChange={e => setSearchEdit({ ...searchEdit, lng: e.target.value })} className="px-3 py-2.5 bg-slate-50 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20" placeholder="經度" />
                                        </div>
                                        <button onClick={() => getDeviceLocation((lt, lg) => setSearchEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="帶入定位">
                                            <Crosshair className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {foundLight && (
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowConfirm({ type: 'search', id: foundLight.id, lat: searchEdit.lat, lng: searchEdit.lng })} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm">存檔更新</button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`⚠️ 警告：確定要永久刪除路燈 ${foundLight.id} 的所有資料嗎？此動作將刪除總表中的該列資料且無法復原。`)) {
                                                        handleSave(foundLight.id, "", "", { action: 'deleteLight' });
                                                    }
                                                }}
                                                className="px-4 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100"
                                                title="刪除此路燈"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* New Light Section */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 px-1"><CheckCircle className="w-4 h-4 text-amber-500" /> 新增路燈編號</h2>
                                <div className="space-y-3">
                                    <input type="text" placeholder="編號(空白則自動產生)" className="w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm outline-none" value={newLightId} onChange={(e) => setNewLightId(e.target.value)} />

                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-amber-800">偵測村里：</span>
                                            <span className={`font - bold ${detectedVillage ? 'text-indigo-600' : 'text-slate-400'} `}>
                                                {detectedVillage || "待定位中..."}
                                            </span>
                                        </div>

                                        <select
                                            value={manualVillage || detectedVillage || ''}
                                            onChange={(e) => setManualVillage(e.target.value)}
                                            className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="" disabled>-- 手動選擇村里 --</option>
                                            {Object.keys(VILLAGE_CODES).map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="grid grid-cols-2 gap-2 flex-1">
                                            <input type="text" value={newLightEdit.lat} onChange={e => setNewLightEdit({ ...newLightEdit, lat: e.target.value })} className="px-3 py-2.5 bg-slate-50 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20" placeholder="緯度" />
                                            <input type="text" value={newLightEdit.lng} onChange={e => setNewLightEdit({ ...newLightEdit, lng: e.target.value })} className="px-3 py-2.5 bg-slate-50 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20" placeholder="經度" />
                                        </div>
                                        <button onClick={() => getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="帶入定位">
                                            <Crosshair className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            id="photo-upload"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleFileChange(e, 'file')}
                                        />
                                        <button
                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                            disabled={isProcessingImage}
                                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors"
                                        >
                                            <ImageIcon className="w-4 h-4" /> {isProcessingImage ? '解析中...' : '照片上傳 (含定位)'}
                                        </button>

                                        <input
                                            type="file"
                                            id="camera-capture"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => handleFileChange(e, 'camera')}
                                        />
                                        <button
                                            onClick={() => {
                                                getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }));
                                                document.getElementById('camera-capture')?.click();
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 bg-sky-50 text-sky-600 py-2.5 rounded-xl font-bold text-xs hover:bg-sky-100 transition-colors"
                                        >
                                            <Camera className="w-4 h-4" /> 手機相機 (即時定位)
                                        </button>
                                    </div>

                                    {selectedImage && (
                                        <div className="relative mt-2 rounded-xl overflow-hidden border border-slate-200">
                                            <img src={selectedImage} alt="Preview" className="w-full h-32 object-cover" />
                                            <button onClick={() => setSelectedImage(null)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full text-[10px]">移除照片</button>
                                        </div>
                                    )}

                                    <button onClick={() => {
                                        const finalVillage = manualVillage || detectedVillage;
                                        if (!newLightEdit.lat || !finalVillage) { alert("請先定位、拍照或選擇村里"); return; }
                                        setShowConfirm({ type: 'new', id: newLightId || '自動產生中...', lat: newLightEdit.lat, lng: newLightEdit.lng });
                                    }} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-900 transition-colors">確認新增路燈</button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-4">
                            <div className="flex items-center justify-between px-2 mb-2">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">最近更動清單</h2>
                                <button
                                    onClick={() => { setLoading(true); fetchHistory().finally(() => setLoading(false)); }}
                                    className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-indigo-500 hover:rotate-180 transition-transform duration-500"
                                    title="重新整理"
                                >
                                    <RefreshCw className={`w - 4 h - 4 ${loading ? 'animate-spin' : ''} `} />
                                </button>
                            </div>

                            {/* Batch Action Bar */}
                            <AnimatePresence>
                                {selectedHistory.size > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg flex items-center justify-between sticky top-2 z-10 mx-1"
                                    >
                                        <div className="flex items-center gap-3">
                                            <button onClick={toggleSelectAll} className="p-1 px-2 bg-white/20 rounded-lg text-[10px] font-bold">
                                                {selectedHistory.size === history.length ? "取消全選" : "全選"}
                                            </button>
                                            <span className="text-xs font-bold">已選擇 {selectedHistory.size} 筆</span>
                                        </div>
                                        <button
                                            onClick={handleBatchDelete}
                                            className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> 批次刪除
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {history.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 italic flex flex-col items-center gap-3">
                                    <History className="w-12 h-12 opacity-20" />
                                    目前無編輯紀錄，請先嘗試儲存資料。
                                </div>
                            ) : (
                                history.map((record, idx) => (
                                    <div key={idx} className={`bg - white rounded - 2xl p - 4 border transition - all duration - 300 ${selectedHistory.has(idx) ? 'border-indigo-400 ring-2 ring-indigo-500/10 shadow-md' : 'border-slate-100 shadow-sm'} space - y - 3`}>
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox */}
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHistory.has(idx)}
                                                    onChange={() => toggleSelect(idx)}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{record.修改時間 || record.時間}</span>
                                                            <span className={`text - [10px] font - bold px - 2 py - 0.5 rounded - full ${record.異動類型 === '新增' || record.操作類型 === '新增' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'} `}>
                                                                {record.異動類型 || record.操作類型}
                                                            </span>
                                                        </div>
                                                        <div className="text-base font-black text-slate-800">編號: {record.路燈編號}</div>
                                                    </div>
                                                    <button onClick={() => { if (confirm('確定要永久刪除這筆歷史紀錄嗎？')) handleSave(record.路燈編號, "", "", { action: 'delete', time: record.修改時間 || record.時間 }) }} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {(record.原本緯度 || record.原緯度) ? (
                                                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-dashed border-slate-200">
                                                        <div className="flex-1 text-center space-y-0.5">
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase">前</div>
                                                            <div className="text-[10px] font-mono text-slate-500 leading-tight">
                                                                {formatCoord(record.原本緯度 || record.原緯度 || "")}<br />
                                                                {formatCoord(record.原本經度 || record.原經度 || "")}
                                                            </div>
                                                        </div>
                                                        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                                                        <div className="flex-1 text-center space-y-0.5">
                                                            <div className="text-[9px] text-indigo-400 font-bold uppercase">後</div>
                                                            <div className="text-[10px] font-mono text-indigo-600 leading-tight">
                                                                {formatCoord(record.更新緯度 || record.新緯度 || "")}<br />
                                                                {formatCoord(record.更新經度 || record.新經度 || "")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-50/50 p-3 rounded-2xl border border-dashed border-amber-200 text-center">
                                                        <div className="text-[9px] text-amber-500 font-bold uppercase mb-0.5">全新座標</div>
                                                        <div className="text-[10px] font-mono text-amber-700">
                                                            {formatCoord(record.更新緯度 || record.新緯度 || "")}, {formatCoord(record.更新經度 || record.新經度 || "")}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    {(record.原本緯度 || record.原緯度) && (
                                                        <button onClick={() => { if (confirm(`確定要將路燈 ${record.路燈編號} 復原為原始座標嗎？`)) handleSave(record.路燈編號, (record.原本緯度 || record.原緯度), (record.原本經度 || record.原經度), { action: 'restore', beforeLat: (record.更新緯度 || record.新緯度), beforeLng: (record.更新經度 || record.新經度) }) }} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-colors">
                                                            <Undo2 className="w-3.5 h-3.5" /> 點此恢復原始座標
                                                        </button>
                                                    )}
                                                    {record.照片連結 && (
                                                        <a href={record.照片連結} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-2 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors">
                                                            <ExternalLink className="w-3.5 h-3.5" /> 查看施工照片
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Global Saving Overlay */}
            <AnimatePresence>
                {isSaving && !showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md"
                    >
                        <div className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-indigo-100 rounded-full" />
                                <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <div className="text-center">
                                <p className="text-slate-800 font-bold">資料同步中</p>
                                <p className="text-slate-500 text-xs">請勿關閉或刷新頁面...</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 relative">
                                    <Save className="w-8 h-8" />
                                    {isSaving && <div className="absolute inset-0 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />}
                                </div>
                                <h3 className="text-2xl font-black text-slate-800">路燈存檔確認</h3>
                                <p className="text-slate-500 text-sm">此動作將同步異動至 Google 雲端</p>
                            </div>
                            <div className="bg-slate-50 rounded-3xl p-5 text-center space-y-2 border border-slate-100">
                                <div className="text-slate-700 text-lg font-black">編號: {showConfirm.id}</div>
                                {showConfirm.type === 'new' && (manualVillage || detectedVillage) && (
                                    <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold inline-block">村里：{manualVillage || detectedVillage}</div>
                                )}
                                <div className="text-slate-400 font-mono text-[11px] pt-1">{showConfirm.lat}<br />{showConfirm.lng}</div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    disabled={isSaving}
                                    onClick={() => {
                                        const finalVillage = manualVillage || detectedVillage;
                                        handleSave(showConfirm.id, showConfirm.lat, showConfirm.lng, {
                                            villageCode: showConfirm.type === 'new' ? VILLAGE_CODES[finalVillage || ''] : undefined,
                                            action: showConfirm.type === 'new' ? 'new' : 'update'
                                        });
                                    }}
                                    className={`w - full bg - indigo - 600 text - white py - 4 rounded - 2xl font - bold shadow - lg shadow - indigo - 200 transition - all ${isSaving ? 'opacity-80' : 'hover:bg-indigo-700'} `}
                                >
                                    {isSaving ? "正在存檔中，請勿關閉..." : "點擊此處確定存檔"}
                                </button>
                                <button disabled={isSaving} onClick={() => setShowConfirm(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors">我再想想，先取消</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
