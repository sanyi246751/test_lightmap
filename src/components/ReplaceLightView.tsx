import React, { useState } from 'react';
import { ChevronLeft, MapPin, Search, CheckCircle, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import { StreetLightData } from '../types';

interface ReplaceLightViewProps {
    lights: StreetLightData[];
    onBack: () => void;
}

export default function ReplaceLightView({ lights, onBack }: ReplaceLightViewProps) {
    const [loading, setLoading] = useState(false);
    const [closestLight, setClosestLight] = useState<StreetLightData | null>(null);
    const [inputLightId, setInputLightId] = useState('');
    const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Calculate distance between two points in meters
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const handleGetClosest = () => {
        setLoading(true);
        if (!navigator.geolocation) {
            alert("您的瀏覽器不支持定位功能");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                let minDistance = Infinity;
                let nearest: StreetLightData | null = null;

                lights.forEach((light) => {
                    const dist = calculateDistance(latitude, longitude, light.lat, light.lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearest = light;
                    }
                });

                setClosestLight(nearest);
                setLoading(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("無法獲取位置資訊");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleCheckAndMark = () => {
        if (!inputLightId.trim()) {
            alert("請輸入路燈編號");
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentCoords({ lat: latitude, lng: longitude });
                setShowConfirm(true);
                setLoading(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("無法獲取定位，無法進行比對");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center gap-4 sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-slate-800">資料置換系統</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Section 1: Find Closest */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Navigation className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">尋找最近路燈</h2>
                            <p className="text-sm text-slate-500">透過定位找出離您最近的路燈編號</p>
                        </div>
                    </div>

                    <button
                        onClick={handleGetClosest}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <MapPin className="w-5 h-5" />
                        )}
                        定位並尋找
                    </button>

                    {closestLight && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col items-center gap-2"
                        >
                            <span className="text-indigo-600 text-sm font-medium">最近路燈編號</span>
                            <span className="text-4xl font-black text-indigo-700">{closestLight.id}</span>
                            <div className="text-xs text-indigo-400 mt-1">
                                座標: {closestLight.lat.toFixed(6)}, {closestLight.lng.toFixed(6)}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Section 2: Input and Confirm */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                            <Search className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">更新路燈座標</h2>
                            <p className="text-sm text-slate-500">輸入編號並將其位置更新至您目前的定位</p>
                        </div>
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="請輸入路燈編號"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-lg font-medium"
                            value={inputLightId}
                            onChange={(e) => setInputLightId(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleCheckAndMark}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <CheckCircle className="w-5 h-5" />
                        )}
                        取得目前定位並確認
                    </button>

                    {showConfirm && currentCoords && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm"
                        >
                            <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl space-y-6">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-black text-slate-800">確認更新？</h3>
                                    <p className="text-slate-500">
                                        即將更新路燈 <span className="font-bold text-emerald-600">{inputLightId}</span> 的座標為目前的定位。
                                    </p>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-1">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">目前定位座標</div>
                                    <div className="text-slate-700 font-mono font-medium">
                                        {currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            alert(`已提交更新請求：${inputLightId} -> ${currentCoords.lat}, ${currentCoords.lng}`);
                                            setShowConfirm(false);
                                        }}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200"
                                    >
                                        確定覆蓋
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold transition-colors"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
