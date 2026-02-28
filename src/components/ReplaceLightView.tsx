import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Search, CheckCircle, Crosshair, RefreshCw, History, Save, Undo2, Trash2, Camera, ExternalLink, X, Check, Cloud, Image as ImageIcon, Smile, Sun, CheckCircle2, Navigation } from 'lucide-react';
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
    const [locationInfo, setLocationInfo] = useState<{ lat: string; lng: string; date?: string; time: string } | null>(null);
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
        console.log('[detectVillage] called with:', lat, lng);
        console.log('[detectVillage] villageData:', !!villageData, villageData?.features?.length);
        if (!villageData || !villageData.features) return null;
        for (const feature of villageData.features) {
            const geometry = feature.geometry;
            let name = feature.properties.VILLNAME;
            if (name === "双湖村") name = "雙湖村";
            if (name === "双潭村") name = "雙潭村";

            if (geometry.type === 'Polygon') {
                if (isPointInPolygon(lng, lat, geometry.coordinates)) {
                    console.log('[detectVillage] FOUND:', name);
                    return name;
                }
            } else if (geometry.type === 'MultiPolygon') {
                for (const polygon of geometry.coordinates) {
                    if (isPointInPolygon(lng, lat, polygon)) {
                        console.log('[detectVillage] FOUND:', name);
                        return name;
                    }
                }
            }
        }
        console.log('[detectVillage] 範圍外');
        return "範圍外";
    };

    const getNextId = (vName: string) => {
        const vCode = VILLAGE_CODES[vName];
        if (!vCode) return '';
        const villageLights = lights.filter(l => l.id.startsWith(vCode));
        if (villageLights.length === 0) return `${vCode}001`;

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
        getDeviceLocation();
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
            alert("哎呀！瀏覽器似乎不支援定位唷 😅");
            setLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const now = new Date();
                const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

                setLocationInfo({
                    lat: latitude.toFixed(5),
                    lng: longitude.toFixed(5),
                    date: dateStr,
                    time: timeStr
                });

                setLoading(false);
                const village = detectVillage(latitude, longitude);
                console.log('[GPS] village detected:', village, '| manualVillage will be set to:', village);
                setDetectedVillage(village);
                if (village) setManualVillage(village);

                if (callback) callback(latitude, longitude);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("找不到位置！請確認 GPS 已經打開啦 🗺️");
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
            alert("找不到這盞路燈，是不是打錯了呢？ 🤔");
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

            const arrayBuffer = await file.arrayBuffer();
            const coords = extractGPSSimplified(arrayBuffer);
            if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
                setNewLightEdit({ lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) });
                const village = detectVillage(coords.lat, coords.lng);
                setDetectedVillage(village);
                if (village) setManualVillage(village);
                alert("哇！成功從照片裡面找到座標囉 🎉");
            } else {
                if (mode === 'file') alert("這張照片似乎沒有包含經緯度資訊唷！");
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
                if (isNaN(lat) || isNaN(lng)) return null;
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
            alert("還沒有設定好存檔的連結耶！");
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
            setToast({ message: "太棒了！存檔完成囉 🌟", type: 'success' });
            setTimeout(() => setToast(null), 3000);
            fetchHistory();
        } catch (error) {
            console.error("Save error:", error);
            setToast({ message: "糟糕！網路怪怪的，存檔失敗了 😿", type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBatchDelete = async () => {
        if (!selectedHistory.size) return;
        if (!confirm(`確定要把這 ${selectedHistory.size} 筆紀錄清空嗎？🧹`)) return;

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
            setToast({ message: "咻～紀錄已經被清乾淨了 ✨", type: 'success' });
            setTimeout(() => setToast(null), 3000);
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
        <div className="h-full w-full bg-[#FFF9F2] flex flex-col font-sans text-slate-700 overflow-hidden selection:bg-[#FFC9B3] selection:text-slate-900">
            {/* Soft, friendly header */}
            <header className="bg-white/60 backdrop-blur-2xl px-5 py-4 border-b border-orange-100/50 sticky top-0 z-30 shadow-[0_4px_20px_rgb(255,142,113,0.03)]">
                <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 p-2.5 -ml-2.5 bg-orange-50 hover:bg-orange-100 text-[#FF8C69] rounded-2xl transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6" strokeWidth={3} />
                    </button>

                    <h1 className="text-xl font-extrabold text-[#FF8C69] tracking-wider flex items-center gap-2 drop-shadow-sm">
                        <Sun className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        資料置換小幫手
                    </h1>

                    <button
                        onClick={() => getDeviceLocation()}
                        className={`flex items-center gap-2 p-2 px-3 bg-white rounded-[1rem] transition-all active:scale-95 shadow-sm border-2 ${locationInfo
                            ? 'border-green-200 text-green-600 bg-green-50/50'
                            : 'border-red-200 text-red-500 bg-red-50/50'
                            }`}
                        title="重新看看我在哪"
                    >
                        <Navigation className={`w-5 h-5 shrink-0 ${loading ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                        <div className="flex flex-col text-left justify-center min-w-[60px]">
                            {locationInfo ? (
                                <>
                                    <span className="text-[11px] font-extrabold leading-tight">定位完成</span>
                                    <span className="text-[9px] font-medium opacity-80 leading-none mt-0.5">{locationInfo.date} {locationInfo.time}</span>
                                </>
                            ) : (
                                <span className="text-[11px] font-extrabold whitespace-nowrap">未定位</span>
                            )}
                        </div>
                    </button>
                </div>

                <div className="max-w-2xl mx-auto w-full flex items-center gap-2 mt-4 text-[13px] font-bold">
                    <div className="flex-1 bg-white p-1.5 rounded-3xl shadow-sm border border-orange-50/50 flex gap-1 relative z-0">
                        <div
                            className="absolute top-1.5 bottom-1.5 w-[calc(50%-4px)] bg-[#FF8C69] rounded-[20px] transition-transform duration-300 ease-spring shadow-md -z-10"
                            style={{ transform: activeTab === 'edit' ? 'translateX(0)' : 'translateX(calc(100% + 2px))' }}
                        />
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex-1 py-2.5 rounded-[20px] flex justify-center items-center gap-2 transition-colors duration-300 ${activeTab === 'edit' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span className={activeTab === 'edit' ? 'drop-shadow-sm' : ''}>✏️ 更新與新增</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-2.5 rounded-[20px] flex justify-center items-center gap-2 transition-colors duration-300 ${activeTab === 'history' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span className={activeTab === 'history' ? 'drop-shadow-sm' : ''}>📖 看看紀錄</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto w-full scroll-smooth pt-4" style={{ scrollbarWidth: 'none' }}>
                <div className="max-w-2xl mx-auto px-5 space-y-6 pb-28">


                    <AnimatePresence mode="wait">
                        {activeTab === 'edit' ? (
                            <motion.div
                                key="edit"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                {/* Search Card */}
                                <section className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(255,140,105,0.06)] border-2 border-orange-50/50">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="bg-orange-100 text-[#FF8C69] p-3 rounded-2xl rotate-3">
                                            <Search className="w-6 h-6" strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-extrabold text-slate-800 tracking-wide">尋找路燈</h2>
                                            <p className="text-[13px] text-slate-400 font-medium">幫現有的路燈換個精準的位置！</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex gap-3">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="輸入路燈編號..."
                                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 hover:border-orange-100 focus:bg-white focus:border-[#FF8C69] rounded-[1.2rem] text-[15px] font-bold text-slate-800 placeholder:text-slate-300 outline-none transition-all shadow-inner"
                                                    value={searchId}
                                                    onChange={(e) => setSearchId(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchId()}
                                                />
                                                {searchId && (
                                                    <button onClick={() => setSearchId('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full transition-colors">
                                                        <X className="w-3.5 h-3.5" strokeWidth={3} />
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleSearchId}
                                                className="px-6 py-3.5 bg-[#FF8C69] hover:bg-[#FF7A52] active:scale-95 text-white font-bold text-[15px] rounded-[1.2rem] shadow-md shadow-orange-200 transition-all"
                                            >
                                                查查看
                                            </button>
                                        </div>

                                        <div className="bg-[#FFFDF9] rounded-[1.5rem] p-4 border-2 border-dashed border-slate-200 flex gap-3 items-center">
                                            <div className="flex-1 grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-extrabold text-slate-400 ml-2">緯度 (Lat)</label>
                                                    <input
                                                        type="text"
                                                        value={searchEdit.lat}
                                                        onChange={e => setSearchEdit({ ...searchEdit, lat: e.target.value })}
                                                        className="w-full px-3 py-3 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                                                        placeholder="24.xxxxx"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-extrabold text-slate-400 ml-2">經度 (Lng)</label>
                                                    <input
                                                        type="text"
                                                        value={searchEdit.lng}
                                                        onChange={e => setSearchEdit({ ...searchEdit, lng: e.target.value })}
                                                        className="w-full px-3 py-3 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                                                        placeholder="120.xxxxx"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => getDeviceLocation((lt, lg) => setSearchEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))}
                                                className="flex flex-col items-center justify-center h-[72px] px-4 mt-[22px] bg-orange-50 hover:bg-[#FF8C69] hover:text-white text-[#FF8C69] rounded-2xl active:scale-95 transition-all text-sm font-bold shadow-sm"
                                            >
                                                <Navigation className="w-5 h-5 mb-1" strokeWidth={2.5} />
                                                定位
                                            </button>
                                        </div>

                                        {foundLight && (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-3 pt-2">
                                                <button
                                                    onClick={() => setShowConfirm({ type: 'search', id: foundLight.id, lat: searchEdit.lat, lng: searchEdit.lng })}
                                                    className="flex-1 bg-[#45CE9D] hover:bg-[#3EBC8D] active:scale-95 shadow-md shadow-emerald-200 text-white py-3.5 rounded-2xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <CheckCircle2 className="w-5 h-5" /> 確定更新！
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`真的要把路燈 ${foundLight.id} 刪掉嗎？這不能復原唷！`)) {
                                                            handleSave(foundLight.id, "", "", { action: 'deleteLight' });
                                                        }
                                                    }}
                                                    className="w-16 flex items-center justify-center bg-white hover:bg-red-50 text-red-400 hover:text-red-500 border-2 border-red-100 rounded-2xl active:scale-95 transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </motion.div>
                                        )}
                                    </div>
                                </section>

                                {/* New Light Section */}
                                <section className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(255,140,105,0.06)] border-2 border-orange-50/50">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-100 text-[#45CE9D] p-3 rounded-2xl -rotate-3">
                                                <Smile className="w-6 h-6" strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-extrabold text-slate-800 tracking-wide">新增路燈編號</h2>
                                                <p className="text-[13px] text-slate-400 font-medium">發現新的路燈！趕快來建檔吧～</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Chips */}
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <button
                                            onClick={() => getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }))}
                                            className="flex flex-col items-center gap-2 p-4 bg-orange-50 hover:bg-[#FF8C69] hover:text-white text-[#FF8C69] rounded-2xl active:scale-95 transition-all text-sm font-bold shadow-sm"
                                        >
                                            <MapPin className="w-7 h-7" strokeWidth={2.5} />
                                            GPS
                                        </button>

                                        <input type="file" id="photo-upload" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'file')} />
                                        <button
                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                            disabled={isProcessingImage}
                                            className="flex flex-col items-center gap-2 p-4 bg-sky-50 hover:bg-[#52C5F4] hover:text-white text-[#52C5F4] rounded-2xl active:scale-95 transition-all text-sm font-bold shadow-sm disabled:opacity-50"
                                        >
                                            {isProcessingImage ? <RefreshCw className="w-7 h-7 animate-spin" /> : <ImageIcon className="w-7 h-7" strokeWidth={2.5} />}
                                            選相片
                                        </button>

                                        <input type="file" id="camera-capture" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'camera')} />
                                        <button
                                            onClick={() => {
                                                getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toFixed(5), lng: lg.toFixed(5) }));
                                                document.getElementById('camera-capture')?.click();
                                            }}
                                            className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-[#A88AE6] hover:text-white text-[#A88AE6] rounded-2xl active:scale-95 transition-all text-sm font-bold shadow-sm"
                                        >
                                            <Camera className="w-7 h-7" strokeWidth={2.5} />
                                            拍張照
                                        </button>
                                    </div>

                                    <div className="bg-[#FFFDF9] rounded-[1.5rem] p-5 border-2 border-dashed border-slate-200 space-y-4">
                                        <div className="flex gap-3">
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-extrabold text-slate-400 ml-2">村里</label>
                                                <div className="relative">
                                                    <select
                                                        value={manualVillage || detectedVillage || ''}
                                                        onChange={(e) => setManualVillage(e.target.value)}
                                                        className="w-full pl-4 pr-10 py-3.5 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-[15px] font-bold text-slate-700 outline-none appearance-none shadow-sm transition-all"
                                                    >
                                                        <option value="" disabled>請選擇...</option>
                                                        {Object.keys(VILLAGE_CODES).map(v => <option key={v} value={v}>{v}</option>)}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none bg-slate-100 p-1.5 rounded-xl">
                                                        <ChevronLeft className="w-4 h-4 text-slate-500 -rotate-90" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-extrabold text-slate-400 ml-2">路燈編號</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-3.5 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-[15px] font-bold text-slate-700 outline-none shadow-sm transition-all placeholder:text-slate-300 placeholder:font-medium"
                                                    value={newLightId}
                                                    onChange={(e) => setNewLightId(e.target.value)}
                                                    placeholder="留空自動產生"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-extrabold text-slate-400 ml-2">緯度 (Lat)</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-[15px] font-bold text-slate-700 outline-none shadow-sm transition-all placeholder:text-slate-200"
                                                    value={newLightEdit.lat}
                                                    onChange={e => setNewLightEdit({ ...newLightEdit, lat: e.target.value })}
                                                    placeholder="必填唷"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-extrabold text-slate-400 ml-2">經度 (Lng)</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-3 bg-white border-2 border-slate-100 focus:border-[#FF8C69] rounded-2xl text-[15px] font-bold text-slate-700 outline-none shadow-sm transition-all placeholder:text-slate-200"
                                                    value={newLightEdit.lng}
                                                    onChange={e => setNewLightEdit({ ...newLightEdit, lng: e.target.value })}
                                                    placeholder="必填唷"
                                                />
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {selectedImage && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                                                    <div className="relative rounded-[1.5rem] overflow-hidden bg-slate-100 border-2 border-slate-200 p-2 text-center group">
                                                        <img src={selectedImage} alt="Preview" className="w-full h-[180px] object-cover rounded-xl shadow-sm" referrerPolicy="no-referrer" />
                                                        <button
                                                            onClick={() => setSelectedImage(null)}
                                                            className="absolute top-4 right-4 bg-white hover:bg-red-50 text-slate-500 hover:text-red-400 p-2 rounded-full shadow-lg active:scale-90 transition-all"
                                                        >
                                                            <X className="w-5 h-5" strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const finalVillage = manualVillage || detectedVillage;
                                            if (!newLightEdit.lat || !finalVillage) { alert("矮額！有欄位忘記填囉，請確認一下喔 🙈"); return; }
                                            setShowConfirm({ type: 'new', id: newLightId || '系統會自動取名', lat: newLightEdit.lat, lng: newLightEdit.lng });
                                        }}
                                        className="w-full bg-[#FF8C69] hover:bg-[#FF7A52] active:scale-95 shadow-lg shadow-orange-200 text-white py-4 rounded-[1.5rem] font-extrabold text-[16px] flex items-center justify-center gap-2 mt-6 transition-all"
                                    >
                                        🚀 確定送出資料
                                    </button>
                                </section>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-5"
                            >
                                <div className="flex justify-between items-center px-2">
                                    <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest pl-2">所有編輯紀錄</h2>
                                </div>

                                <AnimatePresence>
                                    {selectedHistory.size > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-red-50 border-2 border-red-100 text-red-600 px-5 py-3.5 rounded-3xl shadow-sm flex items-center justify-between sticky top-[80px] z-20"
                                        >
                                            <div className="flex items-center gap-3">
                                                <button onClick={toggleSelectAll} className="w-7 h-7 rounded-xl flex items-center justify-center bg-white shadow-sm hover:scale-105 transition-transform text-red-500">
                                                    {selectedHistory.size === history.length ? <X className="w-4 h-4" strokeWidth={3} /> : <Check className="w-4 h-4" strokeWidth={3} />}
                                                </button>
                                                <span className="text-sm font-extrabold pb-0.5">選了 {selectedHistory.size} 筆</span>
                                            </div>
                                            <button
                                                onClick={handleBatchDelete}
                                                className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-red-200 hover:bg-red-600 active:scale-95 transition-all"
                                            >
                                                一起刪掉！
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-4">
                                    {history.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                            <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                                <History className="w-10 h-10 text-slate-200" strokeWidth={2.5} />
                                            </div>
                                            <p className="text-lg font-extrabold text-slate-400">這裡空空的耶</p>
                                            <p className="text-sm font-bold mt-1">等您來幫路燈建檔唷！</p>
                                        </div>
                                    ) : (
                                        history.map((record, idx) => (
                                            <div
                                                key={idx}
                                                className={`bg-white rounded-[2rem] p-5 shadow-sm transition-all duration-300 ${selectedHistory.has(idx) ? 'border-2 border-[#FF8C69] ring-4 ring-orange-50 scale-[1.02]' : 'border-2 border-slate-100 hover:border-orange-100'}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={() => toggleSelect(idx)}
                                                            className={`w-7 h-7 rounded-[10px] flex items-center justify-center transition-all ${selectedHistory.has(idx) ? 'bg-[#FF8C69] text-white shadow-sm' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                                                        >
                                                            <Check className="w-4 h-4" strokeWidth={3} />
                                                        </button>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <h3 className="text-[17px] font-black text-slate-800 tracking-tight">
                                                                    路燈 <span className="text-[#FF8C69]">{record.路燈編號}</span>
                                                                </h3>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-xs font-bold text-slate-400">{record.修改時間 || record.時間}</span>
                                                                    <span className={`text-[10px] px-2.5 py-1 rounded-xl font-extrabold ${record.異動類型 === '新增' || record.操作類型 === '新增' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                                                                        {record.異動類型 || record.操作類型}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => { if (confirm('要把這筆不見嗎？🥺')) handleSave(record.路燈編號, "", "", { action: 'delete', time: record.修改時間 || record.時間 }) }}
                                                                className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>

                                                        {/* Diff Cards */}
                                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                                            <div className="bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl relative overflow-hidden">
                                                                <p className="text-[11px] font-extrabold text-slate-400 mb-1">之前的位置</p>
                                                                <p className="text-xs font-mono font-bold text-slate-600">
                                                                    {formatCoord(record.原本緯度 || record.原緯度 || "---")}<br />
                                                                    {formatCoord(record.原本經度 || record.原經度 || "---")}
                                                                </p>
                                                            </div>
                                                            <div className="bg-orange-50 border-2 border-orange-100/50 p-3 rounded-2xl relative overflow-hidden">
                                                                <div className="absolute -right-2 -bottom-2 opacity-10">
                                                                    <MapPin className="w-10 h-10 text-[#FF8C69]" />
                                                                </div>
                                                                <p className="text-[11px] font-extrabold text-[#FF8C69] mb-1">後來的位置</p>
                                                                <p className="text-xs font-mono font-extrabold text-[#FF8C69]">
                                                                    {formatCoord(record.更新緯度 || record.新緯度 || "---")}<br />
                                                                    {formatCoord(record.更新經度 || record.新經度 || "---")}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex gap-2">
                                                            {(record.原本緯度 || record.原緯度) && (
                                                                <button onClick={() => { if (confirm(`還原回之前的位置嗎？`)) handleSave(record.路燈編號, (record.原本緯度 || record.原緯度), (record.原本經度 || record.原經度), { action: 'restore', beforeLat: (record.更新緯度 || record.新緯度), beforeLng: (record.更新經度 || record.新經度) }) }} className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-100 rounded-[14px] text-xs font-extrabold text-slate-500 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                                                    <Undo2 className="w-4 h-4" strokeWidth={2.5} /> 還原
                                                                </button>
                                                            )}
                                                            {record.照片連結 && (
                                                                <a href={record.照片連結} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-100 rounded-[14px] text-xs font-extrabold text-slate-500 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                                                    <ImageIcon className="w-4 h-4" strokeWidth={2.5} /> 照片
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Cute Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110]"
                    >
                        <div className="flex items-center gap-3 bg-white pl-3 pr-5 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] border-2 border-slate-50 text-slate-700 min-w-max">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-500' : 'bg-red-100 text-red-500'}`}>
                                {toast.type === 'success' ? <Smile className="w-6 h-6" strokeWidth={2.5} /> : <X className="w-6 h-6" strokeWidth={2.5} />}
                            </div>
                            <p className="text-[15px] font-extrabold">{toast.message}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay / Loading Cute Character */}
            <AnimatePresence>
                {isSaving && !showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-md"
                    >
                        <div className="bg-white rounded-[2rem] p-8 flex flex-col items-center gap-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)] border-2 border-orange-50/50">
                            <div className="relative">
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-16 h-16 border-[5px] border-orange-100 border-t-[#FF8C69] rounded-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Cloud className="w-6 h-6 text-[#FF8C69] animate-bounce" fill="#FF8C69" fillOpacity="0.2" />
                                </div>
                            </div>
                            <p className="text-[17px] font-extrabold text-slate-700">正在努力幫您存檔囉... 🏃‍♂️</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirm Dialog - Friendly Card */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl flex flex-col p-6 border-4 border-white"
                        >
                            <div className="flex flex-col items-center text-center gap-2 mb-6 mt-2">
                                <div className="w-20 h-20 bg-orange-50 text-[#FF8C69] rounded-[2rem] flex items-center justify-center mb-2 rotate-3 shadow-inner">
                                    <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800">準備好要存檔了嗎？</h3>
                                <p className="text-sm font-bold text-slate-400">
                                    再幫我確認一下資料對不對唷 👀
                                </p>
                            </div>

                            <div className="bg-[#FFFDF9] rounded-3xl p-5 border-2 border-dashed border-[#FFC9B3] mb-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-white/50 rounded-full -mr-8 -mt-8 blur-xl" />
                                <div className="flex items-center gap-3 mb-3 relative z-10">
                                    <h4 className="font-black text-lg text-slate-700">路燈 {showConfirm.id}</h4>
                                    <span className="text-xs font-bold text-[#FF8C69] border-2 border-[#FFC9B3] bg-white rounded-xl px-2 py-0.5">
                                        {showConfirm.type === 'new' ? '建立紀錄' : '修正座標'}
                                    </span>
                                </div>
                                {showConfirm.type === 'new' && (manualVillage || detectedVillage) && (
                                    <div className="text-[13px] font-bold text-slate-500 mb-2 relative z-10">
                                        📍 被分配到：<span className="text-slate-700">{manualVillage || detectedVillage}</span>
                                    </div>
                                )}
                                <div className="text-[13px] font-mono font-bold text-slate-500 bg-white p-3 rounded-2xl border-2 border-slate-100 relative z-10 shadow-sm flex items-center justify-around">
                                    <div className="flex items-center gap-1.5">
                                        <span className="opacity-70">Lat:</span>
                                        <span className="text-slate-700">{showConfirm.lat}</span>
                                    </div>
                                    <div className="w-px h-4 bg-slate-200"></div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="opacity-70">Lng:</span>
                                        <span className="text-slate-700">{showConfirm.lng}</span>
                                    </div>
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
                                    className="w-full py-4 bg-[#FF8C69] hover:bg-[#FF7A52] active:scale-95 text-white font-extrabold text-[17px] rounded-[1.5rem] shadow-lg shadow-orange-200 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? "處理中..." : "沒錯，幫我存檔！"}
                                </button>
                                <button
                                    disabled={isSaving}
                                    onClick={() => setShowConfirm(null)}
                                    className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-extrabold text-[17px] rounded-[1.5rem] transition-all active:scale-95"
                                >
                                    等一下，我再看一下
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
