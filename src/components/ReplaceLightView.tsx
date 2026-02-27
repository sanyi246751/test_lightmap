import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Search, CheckCircle, Navigation, Crosshair, RefreshCw, History, ArrowLeftCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StreetLightData, HistoryRecord } from '../types';
import { HISTORY_SHEET_URL, GAS_WEB_APP_URL } from '../constants';

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
    const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');
    const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Village Detection State
    const [detectedVillage, setDetectedVillage] = useState<string | null>(null);

    // Point in Polygon Helper
    const isPointInPolygon = (lat: number, lng: number, polygon: any) => {
        let inside = false;
        // GeoJSON uses [lng, lat]
        const coords = polygon[0]; // Assuming single ring for simplicity or handle holes
        for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
            const xi = coords[i][0], yi = coords[i][1];
            const xj = coords[j][0], yj = coords[j][1];
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
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

    // History State
    const [history, setHistory] = useState<HistoryRecord[]>([]);

    // Closest Light State
    const [closestLight, setClosestLight] = useState<StreetLightData | null>(null);
    const [closestEdit, setClosestEdit] = useState({ lat: '', lng: '' });

    // Search ID State
    const [searchId, setSearchId] = useState('');
    const [foundLight, setFoundLight] = useState<StreetLightData | null>(null);
    const [searchEdit, setSearchEdit] = useState({ lat: '', lng: '' });

    // New Light State
    const [newLightId, setNewLightId] = useState('');
    const [newLightEdit, setNewLightEdit] = useState({ lat: '', lng: '' });

    const [showConfirm, setShowConfirm] = useState<{ type: 'closest' | 'search' | 'new', id: string, lat: string, lng: string } | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await fetch(HISTORY_SHEET_URL);
            const data = await res.json();
            if (Array.isArray(data)) {
                // Reverse to show newest first
                setHistory(data.reverse());
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
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
                setDeviceCoords({ lat: latitude, lng: longitude });
                setLoading(false);

                // Village Detection
                const village = detectVillage(latitude, longitude);
                setDetectedVillage(village);

                if (callback) callback(latitude, longitude);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("無法獲取位置資訊");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleFindClosest = () => {
        getDeviceLocation((lat, lng) => {
            let minDistance = Infinity;
            let nearest: StreetLightData | null = null;
            lights.forEach((light) => {
                const dist = calculateDistance(lat, lng, light.lat, light.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearest = light;
                }
            });
            if (nearest) {
                setClosestLight(nearest);
                setClosestEdit({ lat: nearest.lat.toString(), lng: nearest.lng.toString() });
            }
        });
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

    const handleSave = async (id: string, lat: string, lng: string, villageCode?: string) => {
        if (!GAS_WEB_APP_URL) {
            alert("尚未設定 GAS_WEB_APP_URL，請先部署 Apps Script 並更新 constants.ts");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    lat,
                    lng,
                    villageCode,
                    type: villageCode ? "new" : "update",
                    note: villageCode ? "新設路燈" : "座標更新"
                })
            });

            alert(`✅ 提交成功 (路燈 ${id})！\n這筆資料將儲存至 Google Sheets。`);
            setShowConfirm(null);
            fetchHistory();
            setActiveTab('history');

            // If it was a new light, reset form
            if (villageCode) {
                setNewLightId('');
                setNewLightEdit({ lat: '', lng: '' });
                setDetectedVillage(null);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("儲存失敗，請檢查連線或 GAS 設定。");
        } finally {
            setLoading(false);
        }
    };

    const recoverFromHistory = (record: HistoryRecord) => {
        setSearchId(record.路燈編號);
        setFoundLight(lights.find(l => l.id === record.路燈編號) || null);
        setSearchEdit({ lat: record.緯度Latitude.toString(), lng: record.經度Longitude.toString() });
        setActiveTab('edit');
        // Scroll to Search Section
        setTimeout(() => {
            const searchInput = document.getElementById('search-id-input');
            searchInput?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white px-4 py-4 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800">資料置換系統</h1>
                    </div>
                    <button
                        onClick={() => getDeviceLocation()}
                        className={`p-2 rounded-xl transition-all ${deviceCoords ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'} hover:scale-105 active:scale-95`}
                    >
                        <Crosshair className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-2xl relative">
                    <div
                        className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${activeTab === 'history' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
                    />
                    <button
                        onClick={() => setActiveTab('edit')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors ${activeTab === 'edit' ? 'text-indigo-600' : 'text-slate-500'}`}
                    >
                        <RefreshCw className="w-4 h-4" /> 編輯資料
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500'}`}
                    >
                        <History className="w-4 h-4" /> 歷史紀錄
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
                <AnimatePresence mode="wait">
                    {activeTab === 'edit' ? (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {/* Find Closest Section */}
                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                        <Navigation className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">尋找最近路燈</h2>
                                        <p className="text-sm text-slate-500">定位找出最接近的路燈</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleFindClosest}
                                    disabled={loading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                                    定位並尋找最近路燈
                                </button>

                                {closestLight && (
                                    <div className="space-y-4 pt-2">
                                        <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex flex-col items-center">
                                            <span className="text-indigo-600 text-sm font-bold">最近編號: {closestLight.id}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text" value={closestEdit.lat}
                                                onChange={e => setClosestEdit({ ...closestEdit, lat: e.target.value })}
                                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" placeholder="緯度"
                                            />
                                            <input
                                                type="text" value={closestEdit.lng}
                                                onChange={e => setClosestEdit({ ...closestEdit, lng: e.target.value })}
                                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" placeholder="經度"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setShowConfirm({ type: 'closest', id: closestLight.id, lat: closestEdit.lat, lng: closestEdit.lng })}
                                            className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold"
                                        >
                                            確認並存檔
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ID Search Section */}
                            <div id="search-section" className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                        <Search className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">搜尋路燈編號</h2>
                                        <p className="text-sm text-slate-500">輸入編號手動編輯座標</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        id="search-id-input"
                                        type="text" placeholder="輸入編號 (例: 001)"
                                        className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none"
                                        value={searchId} onChange={(e) => setSearchId(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchId()}
                                    />
                                    <button onClick={handleSearchId} className="bg-emerald-600 text-white px-6 rounded-2xl font-bold">搜尋</button>
                                </div>

                                {foundLight && (
                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text" value={searchEdit.lat}
                                                onChange={e => setSearchEdit({ ...searchEdit, lat: e.target.value })}
                                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" placeholder="緯度"
                                            />
                                            <input
                                                type="text" value={searchEdit.lng}
                                                onChange={e => setSearchEdit({ ...searchEdit, lng: e.target.value })}
                                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" placeholder="經度"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => getDeviceLocation((lt, lg) => setSearchEdit({ lat: lt.toString(), lng: lg.toString() }))} className="flex-1 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs">
                                                <Crosshair className="w-4 h-4" /> 帶入定位
                                            </button>
                                            <button onClick={() => setShowConfirm({ type: 'search', id: foundLight.id, lat: searchEdit.lat, lng: searchEdit.lng })} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm">存檔更新</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* New Light Section */}
                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">新增路燈編號</h2>
                                        <p className="text-sm text-slate-500">填寫全新編號並帶入定位座標</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text" placeholder="輸入全新編號"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none"
                                        value={newLightId} onChange={(e) => setNewLightId(e.target.value)}
                                    />
                                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Navigation className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-bold text-amber-800">偵測村里：</span>
                                        </div>
                                        <span className={`text-sm font-bold ${detectedVillage ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            {detectedVillage || "待定位..."}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text" value={newLightEdit.lat}
                                            readOnly
                                            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono text-slate-400" placeholder="緯度"
                                        />
                                        <input
                                            type="text" value={newLightEdit.lng}
                                            readOnly
                                            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono text-slate-400" placeholder="經度"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => getDeviceLocation((lt, lg) => setNewLightEdit({ lat: lt.toString(), lng: lg.toString() }))}
                                            className="flex-1 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
                                        >
                                            <Crosshair className="w-4 h-4" /> 帶入定位
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!newLightId.trim() || !newLightEdit.lat || !newLightEdit.lng) {
                                                    alert("請輸入編號並帶入定位座標");
                                                    return;
                                                }
                                                setShowConfirm({ type: 'new', id: newLightId.trim(), lat: newLightEdit.lat, lng: newLightEdit.lng });
                                            }}
                                            className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold text-sm"
                                        >
                                            確認新增
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-4"
                        >
                            {history.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 italic">目前無編輯紀錄</div>
                            ) : (
                                history.map((record, idx) => (
                                    <div key={idx} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{record.時間}</span>
                                                <span className="font-bold text-slate-800">編號: {record.路燈編號}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                {record.緯度Latitude}, {record.經度Longitude}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => recoverFromHistory(record)}
                                            className="p-3 bg-slate-50 text-indigo-500 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                            title="復原"
                                        >
                                            <ArrowLeftCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Save className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800">確認存檔？</h3>
                                <p className="text-slate-500 text-sm">更新將同步至 Google 試算表</p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-1 border border-slate-100">
                                <div className="text-slate-700 font-bold">{showConfirm.id}</div>
                                {showConfirm.type === 'new' && detectedVillage && (
                                    <div className="text-amber-600 text-xs font-bold">新設於：{detectedVillage}</div>
                                )}
                                <div className="text-slate-500 font-mono text-xs">{showConfirm.lat}, {showConfirm.lng}</div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleSave(showConfirm.id, showConfirm.lat, showConfirm.lng, showConfirm.type === 'new' ? VILLAGE_CODES[detectedVillage || ''] : undefined)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">確定存檔</button>
                                <button onClick={() => setShowConfirm(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">取消</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
