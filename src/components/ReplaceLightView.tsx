import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Search, CheckCircle, Crosshair, RefreshCw, History, Save, Undo2, Trash2, ArrowRight, Clock, Image as ImageIcon, Camera, ExternalLink, X, Check, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StreetLightData } from '../types';
import { GAS_WEB_APP_URL } from '../constants';

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
    "鯉魚潭村": "07",
    "範圍外": "99"
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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
        return "範圍外";
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
    }, [manualVillage, detectedVillage, lights]);

    useEffect(() => {
        fetchHistory();
        getDeviceLocation(); // 進入系統預先定位
    }, []);

    const fetchHistory = async () => {
        if (!GAS_WEB_APP_URL) return;
        try {
            const res = await fetch(`${GAS_WEB_APP_URL}?t=${Date.now()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setHistory(data);
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
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

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
                alert("無法獲取位置資訊，請確認 GPS 已開啟並且網頁有定位授權。");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSearchId = () => {
        const light = lights.find(l => l.id === searchId.trim());
        if (light) {
            setFoundLight(light);
            setSearchEdit({ lat: formatCoord(light.lat), lng: formatCoord(light.lng) });
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
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            setSelectedImage(base64);

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
            e.target.value = '';
        }
    };

    const extractGPSSimplified = (buffer: ArrayBuffer) => {
        const dv = new DataView(buffer);
        if (dv.getUint16(0) !== 0xFFD8) return null;

        let offset = 2;
        while (offset < dv.byteLength) {
            if (dv.getUint16(offset) === 0xFFE1) {
                const exifData = parseExif(dv, offset + 4);
                return exifData;
            }
            offset += 2 + dv.getUint16(offset + 2);
        }
        return null;
    };

    const parseExif = (dv: DataView, offset: number) => {
        if (dv.getUint32(offset) !== 0x45786966) return null;

        const littleEndian = dv.getUint16(offset + 6) === 0x4949;
        const ifd0Offset = dv.getUint32(offset + 10, littleEndian);

        function getGPS(ifdOffset: number): { lat: number, lng: number } | null {
            const numEntries = dv.getUint16(offset + 6 + ifdOffset, littleEndian);
            let gpsIFDOffset = -1;

            for (let i = 0; i < numEntries; i++) {
                const entryOffset = offset + 6 + ifdOffset + 2 + i * 12;
                const tag = dv.getUint16(entryOffset, littleEndian);
                if (tag === 0x8825) {
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
            setToast({ message: "資料已成功同步！", type: 'success' });
            setTimeout(() => setToast(null), 3000);
            fetchHistory();
        } catch (error) {
            console.error("Save error:", error);
            setToast({ message: "儲存失敗，請檢查網路。", type: 'error' });
            setTimeout(() => setToast(null), 3000);
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
            <header className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-slate-100 sticky top-0 z-30">
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 text-slate-500"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">置換系統</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">資料置換</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <div className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-1.5 ${locationInfo ? 'text-indigo-600' : 'text-slate-300'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${locationInfo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
                                {locationInfo ? 'GPS 已啟動' : 'GPS 待命'}
                            </div>
                            {locationInfo && (
                                <div className="text-[9px] font-mono text-slate-400">
                                    {locationInfo.lat}, {locationInfo.lng}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => getDeviceLocation()}
                            className={`p-3 rounded-2xl transition-all ${locationInfo ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-slate-100 text-slate-400'} hover:scale-105 active:scale-95 group relative overflow-hidden`}
                        >
                            {locationInfo && (
                                <motion.div
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    className="absolute inset-0 bg-white/10 skew-x-12"
                                />
                            )}
                            <Crosshair className={`w-5 h-5 relative z-10 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="max-w-lg mx-auto mt-4">
                    <div className="flex bg-slate-100/50 p-1 rounded-2xl relative">
                        <motion.div
                            layoutId="activeTab"
                            className="absolute inset-y-1 bg-white rounded-xl shadow-sm z-0"
                            style={{
                                width: 'calc(50% - 4px)',
                                left: activeTab === 'edit' ? '4px' : 'calc(50% + 0px)'
                            }}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black z-10 transition-colors ${activeTab === 'edit' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> 編輯資料
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black z-10 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                            <History className="w-3.5 h-3.5" /> 歷史紀錄
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-24">
                <div className="max-w-lg mx-auto p-4 space-y-6">
                    <AnimatePresence mode="wait">
                        {activeTab === 'edit' ? (
                            <motion.div
                                key="edit"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                {/* Search Section */}
                                <section className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 relative overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Search className="w-4 h-4" /> 修改現有路燈
                                        </h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="輸入路燈編號..."
                                                    className="w-full pl-5 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                    value={searchId}
                                                    onChange={(e) => setSearchId(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchId()}
                                                />
                                                {searchId && (
                                                    <button onClick={() => setSearchId('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleSearchId}
                                                className="bg-slate-900 text-white px-6 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-slate-200"
                                            >
                                                搜尋
                                            </button>
                                        </div>

                                        <div className="bg-slate-50/50 rounded-3xl p-4 border border-slate-100 space-y-4">
                                            {/* Map Placeholder */}
                                            <div className="h-24 bg-slate-100 rounded-2xl relative overflow-hidden border border-slate-200/50 group">
                                                <div className="absolute inset-0 opacity-20">
                                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="relative">
                                                        <motion.div
                                                            animate={{ scale: [1, 1.2, 1] }}
                                                            transition={{ repeat: Infinity, duration: 2 }}
                                                            className="w-8 h-8 bg-indigo-500/10 rounded-full flex items-center justify-center"
                                                        >
                                                            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                        </motion.div>
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-indigo-500/20 rounded-full animate-ping" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-2 left-3 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">信號已鎖定</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">緯度</label>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            value={searchEdit.lat}
                                                            onChange={e => setSearchEdit({ ...searchEdit, lat: e.target.value })}
                                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-mono font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all group-hover:border-indigo-200"
                                                            placeholder="0.00000"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/30 group-focus-within:bg-indigo-500 transition-colors" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">經度</label>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            value={searchEdit.lng}
                                                            onChange={e => setSearchEdit({ ...searchEdit, lng: e.target.value })}
                                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-mono font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all group-hover:border-indigo-200"
                                                            placeholder="0.00000"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/30 group-focus-within:bg-indigo-500 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => getDeviceLocation((lt, lg) => setSearchEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))}
                                                className="w-full py-3 bg-white border border-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 hover:text-indigo-600 transition-all active:scale-95"
                                            >
                                                <Crosshair className="w-3 h-3" /> 使用當前位置
                                            </button>
                                        </div>

                                        {foundLight && (
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setShowConfirm({ type: 'search', id: foundLight.id, lat: searchEdit.lat, lng: searchEdit.lng })}
                                                    className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                                                >
                                                    更新座標
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`⚠️ 確定要刪除路燈 ${foundLight.id} 嗎？`)) {
                                                            handleSave(foundLight.id, "", "", { action: 'deleteLight' });
                                                        }
                                                    }}
                                                    className="px-5 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors border border-rose-100"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* New Light Section */}
                                <section className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 relative overflow-hidden">
                                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> 新增路燈位置
                                    </h2>

                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))}
                                            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                                        >
                                            <MapPin className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">定位</span>
                                        </button>

                                        <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'file')} />
                                        <button
                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                            disabled={isProcessingImage}
                                            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group disabled:opacity-50"
                                        >
                                            <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{isProcessingImage ? '處理中' : '相簿'}</span>
                                        </button>

                                        <input type="file" id="camera-capture" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'camera')} />
                                        <button
                                            onClick={() => {
                                                getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }));
                                                document.getElementById('camera-capture')?.click();
                                            }}
                                            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-sky-50 hover:text-sky-600 transition-all group"
                                        >
                                            <Camera className="w-5 h-5 text-slate-400 group-hover:text-sky-600 transition-colors" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">拍照</span>
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100 space-y-5">
                                            {/* Map Placeholder */}
                                            <div className="h-24 bg-slate-100 rounded-2xl relative overflow-hidden border border-slate-200/50 group">
                                                <div className="absolute inset-0 opacity-20">
                                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="relative">
                                                        <motion.div
                                                            animate={{ scale: [1, 1.2, 1] }}
                                                            transition={{ repeat: Infinity, duration: 2 }}
                                                            className="w-8 h-8 bg-indigo-500/10 rounded-full flex items-center justify-center"
                                                        >
                                                            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                        </motion.div>
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-indigo-500/20 rounded-full animate-ping" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-2 left-3 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">信號已鎖定</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">村里與編號</label>
                                                    {detectedVillage && (
                                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                            自動偵測: {detectedVillage}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                                    <select
                                                        value={manualVillage || detectedVillage || ''}
                                                        onChange={(e) => setManualVillage(e.target.value)}
                                                        className="bg-slate-50 border-r border-slate-100 px-4 py-3 text-xs font-black text-slate-600 outline-none appearance-none"
                                                    >
                                                        <option value="" disabled>村里</option>
                                                        {Object.keys(VILLAGE_CODES).map(v => <option key={v} value={v}>{v}</option>)}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="編號 (留空自動產生)"
                                                        className="w-full px-4 py-3 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300"
                                                        value={newLightId}
                                                        onChange={(e) => setNewLightId(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">緯度</label>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            value={newLightEdit.lat}
                                                            onChange={e => setNewLightEdit({ ...newLightEdit, lat: e.target.value })}
                                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-mono font-bold text-indigo-600 outline-none group-focus-within:ring-2 group-focus-within:ring-indigo-500/10 transition-all"
                                                            placeholder="0.00000"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/30 group-focus-within:bg-indigo-500 transition-colors" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">經度</label>
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            value={newLightEdit.lng}
                                                            onChange={e => setNewLightEdit({ ...newLightEdit, lng: e.target.value })}
                                                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-mono font-bold text-indigo-600 outline-none group-focus-within:ring-2 group-focus-within:ring-indigo-500/10 transition-all"
                                                            placeholder="0.00000"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/30 group-focus-within:bg-indigo-500 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedImage && (
                                                <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                                                    <img src={selectedImage} alt="Preview" className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                                                    <button
                                                        onClick={() => setSelectedImage(null)}
                                                        className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-white p-2 rounded-xl hover:bg-slate-900 transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                const finalVillage = manualVillage || detectedVillage;
                                                if (!newLightEdit.lat || !finalVillage) { alert("請先定位並選擇村里"); return; }
                                                setShowConfirm({ type: 'new', id: newLightId || '自動產生中...', lat: newLightEdit.lat, lng: newLightEdit.lng });
                                            }}
                                            className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                        >
                                            確認新增路燈 <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </section>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between px-2">
                                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最近更動清單</h2>
                                    <button
                                        onClick={() => { setLoading(true); fetchHistory().finally(() => setLoading(false)); }}
                                        className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-indigo-500 active:rotate-180 transition-transform duration-500"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                <AnimatePresence>
                                    {selectedHistory.size > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="bg-indigo-600 text-white p-4 rounded-[2rem] shadow-xl shadow-indigo-100 flex items-center justify-between sticky top-4 z-20"
                                        >
                                            <div className="flex items-center gap-4">
                                                <button onClick={toggleSelectAll} className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                                                    {selectedHistory.size === history.length ? <X className="w-3 h-3" /> : <div className="w-2 h-2 bg-white rounded-full" />}
                                                </button>
                                                <span className="text-xs font-black uppercase tracking-widest">已選 {selectedHistory.size} 筆</span>
                                            </div>
                                            <button
                                                onClick={handleBatchDelete}
                                                className="bg-white text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> 批次刪除
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-4">
                                    {history.length === 0 ? (
                                        <div className="py-32 text-center space-y-6">
                                            <div className="relative mx-auto w-24 h-24">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                                                    className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-[2.5rem]"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-200">
                                                    <History className="w-10 h-10" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">目前無編輯紀錄</p>
                                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">查無歷史紀錄</p>
                                            </div>
                                        </div>
                                    ) : (
                                        history.map((record, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className={`bg-white rounded-[2.5rem] p-6 border transition-all duration-300 ${selectedHistory.has(idx) ? 'border-indigo-400 ring-4 ring-indigo-500/5 shadow-xl' : 'border-slate-100 shadow-sm'} space-y-4`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={() => toggleSelect(idx)}
                                                        className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${selectedHistory.has(idx) ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-100'}`}
                                                    >
                                                        {selectedHistory.has(idx) && <Check className="w-3 h-3 text-white" />}
                                                    </button>

                                                    <div className="flex-1 space-y-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase tracking-widest">{record.修改時間 || record.時間}</span>
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${record.異動類型 === '新增' || record.操作類型 === '新增' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                        {record.異動類型 || record.操作類型}
                                                                    </span>
                                                                </div>
                                                                <h3 className="text-xl font-black text-slate-800 tracking-tight">路燈 {record.路燈編號}</h3>
                                                            </div>
                                                            <button onClick={() => { if (confirm('確定刪除？')) handleSave(record.路燈編號, "", "", { action: 'delete', time: record.修改時間 || record.時間 }) }} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 relative group overflow-hidden">
                                                                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                                                    <MapPin className="w-12 h-12" />
                                                                </div>
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">原始座標</p>
                                                                <p className="text-[10px] font-mono font-bold text-slate-500 leading-tight relative z-10">
                                                                    {formatCoord(record.原本緯度 || record.原緯度 || "---")}<br />
                                                                    {formatCoord(record.原本經度 || record.原經度 || "---")}
                                                                </p>
                                                            </div>
                                                            <div className="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/20 relative group overflow-hidden">
                                                                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                                                    <Crosshair className="w-12 h-12 text-indigo-600" />
                                                                </div>
                                                                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">更新座標</p>
                                                                <p className="text-[10px] font-mono font-bold text-indigo-600 leading-tight relative z-10">
                                                                    {formatCoord(record.更新緯度 || record.新緯度 || "---")}<br />
                                                                    {formatCoord(record.更新經度 || record.新經度 || "---")}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            {(record.原本緯度 || record.原緯度) && (
                                                                <button onClick={() => { if (confirm(`確定復原？`)) handleSave(record.路燈編號, (record.原本緯度 || record.原緯度), (record.原本經度 || record.原經度), { action: 'restore', beforeLat: (record.更新緯度 || record.新緯度), beforeLng: (record.更新經度 || record.新經度) }) }} className="flex-1 flex items-center justify-center gap-2 bg-slate-50 text-slate-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">
                                                                    <Undo2 className="w-3 h-3" /> 復原
                                                                </button>
                                                            )}
                                                            {record.照片連結 && (
                                                                <a href={record.照片連結} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-colors">
                                                                    <ExternalLink className="w-3 h-3" /> 照片
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-3rem)] max-w-xs"
                    >
                        <div className={`flex items-center gap-3 p-4 rounded-3xl shadow-2xl backdrop-blur-xl border ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' : 'bg-rose-500/90 border-rose-400/50 text-white'}`}>
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">{toast.type === 'success' ? '成功' : '錯誤'}</p>
                                <p className="text-sm font-bold">{toast.message}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isSaving && !showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl"
                    >
                        <div className="bg-white rounded-[3rem] p-10 flex flex-col items-center gap-6 shadow-2xl border border-white/20">
                            <div className="relative">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Cloud className="w-6 h-6 text-indigo-600 animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">資料同步中</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">資料同步中...</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-slate-900/80 backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl space-y-8 border border-white/20"
                        >
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto relative overflow-hidden">
                                    <Save className="w-8 h-8 relative z-10" />
                                    {isSaving && (
                                        <motion.div
                                            animate={{ y: ["100%", "-100%"] }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                            className="absolute inset-0 bg-indigo-100/50"
                                        />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">存檔確認</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">確認同步資料</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-[2rem] p-6 text-center space-y-3 border border-slate-100">
                                <div className="text-xl font-black text-slate-800 tracking-tight">路燈 {showConfirm.id}</div>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {showConfirm.type === 'new' && (manualVillage || detectedVillage) && (
                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                                            {manualVillage || detectedVillage}
                                        </span>
                                    )}
                                    <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                        {showConfirm.type === 'new' ? '新增資料' : '更新座標'}
                                    </span>
                                </div>
                                <div className="text-slate-400 font-mono text-[10px] pt-2 leading-relaxed">
                                    LAT: {showConfirm.lat}<br />
                                    LNG: {showConfirm.lng}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    disabled={isSaving}
                                    onClick={() => {
                                        const finalVillage = manualVillage || detectedVillage;
                                        handleSave(showConfirm.id, showConfirm.lat, showConfirm.lng, {
                                            villageCode: showConfirm.type === 'new' ? VILLAGE_CODES[finalVillage || ''] : undefined,
                                            action: showConfirm.type === 'new' ? 'new' : 'update'
                                        });
                                    }}
                                    className={`w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600 hover:shadow-indigo-100 active:scale-95'}`}
                                >
                                    {isSaving ? "同步中..." : "確定存檔同步"}
                                </button>
                                <button
                                    disabled={isSaving}
                                    onClick={() => setShowConfirm(null)}
                                    className="w-full bg-slate-100 text-slate-400 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 hover:text-slate-600 transition-all active:scale-95"
                                >
                                    返回修改
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
