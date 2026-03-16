import React, { useState, useEffect, useRef } from 'react';
import './RepairReportView.css';
import { ChevronLeft } from 'lucide-react';
// @ts-ignore
import * as EXIF from 'exif-js';
import { SHEET_URL } from '../constants';
import { StreetLightLocation } from '../types';

// GAS WEB APP URL 供使用者日後自行替換
const SURVEY_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwAy3gjvGTXllNFKPhE3VEiPos7kZXn1qUWxUbZ6tPnicu7lOY3leznPl1-2J0yM24wPA/exec";

interface BaseSurveyViewProps {
    onBack: () => void;
}

export default function BaseSurveyView({ onBack }: BaseSurveyViewProps) {
    const [rDate, setRDate] = useState("");
    const [gpsLightId, setGpsLightId] = useState<string>("");
    const [gpsLat, setGpsLat] = useState<number | null>(null);
    const [gpsLng, setGpsLng] = useState<number | null>(null);

    const [lightsDict, setLightsDict] = useState<StreetLightLocation[]>([]);

    const [prePhoto, setPrePhoto] = useState<string | null>(null);
    const [postPhoto, setPostPhoto] = useState<string | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadText, setUploadText] = useState("0.0%");
    const [uploadTitle, setUploadTitle] = useState("📤 正在處理資料");

    const smoothIntervalRef = useRef<any>(null);
    const lastKnownLoc = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
        setRDate(localISOTime);
        fetch(SHEET_URL)
            .then(r => r.json())
            .then(d => setLightsDict(d))
            .catch(err => console.error("Error fetching light references:", err));
    }, []);

    const handlePick = (inputId: string) => {
        if (inputId.includes('pre')) {
            preFetchLocation();
        }
        const el = document.getElementById(inputId);
        if (el) {
            el.removeAttribute("capture"); // 移除強制拍照屬性，讓它回歸選相簿功能
            el.click();
        }
    };

    const handleCam = (inputId: string) => {
        if (inputId.includes('pre')) {
            preFetchLocation();
        }
        const el = document.getElementById(inputId);
        if (el) {
            el.setAttribute("capture", "environment");
            el.click();
        }
    };

    const preFetchLocation = () => {
        if (!("geolocation" in navigator)) return;
        
        // 開始背景定位，但不鎖定 UI
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                lastKnownLoc.current = { lat: latitude, lng: longitude };
                console.log("[GPS] Background pre-fetch success:", latitude, longitude);
                
                // 如果目前輸入框是空的，可以考慮直接幫它算一下最近路燈 (悄悄進行)
                if (!gpsLightId && lightsDict.length > 0) {
                    findClosestLightQuietly(latitude, longitude);
                }
            },
            (err) => console.warn("[GPS] Background pre-fetch failed:", err),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const findClosestLightQuietly = (lat: number, lng: number) => {
        setGpsLat(lat);
        setGpsLng(lng);
        let minLightId = "";
        let minD = Infinity;
        for (let l of lightsDict) {
            let lLat = parseFloat(l["緯度Latitude"]);
            let lLng = parseFloat(l["經度Longitude"]);
            if (!isNaN(lLat) && !isNaN(lLng)) {
                let d = getDistance(lat, lng, lLat, lLng);
                if (d < minD) {
                    minD = d;
                    minLightId = l["原路燈號碼"]?.trim() || "";
                }
            }
        }
        if (minLightId) setGpsLightId(minLightId);
    };

    const convertDMSToDD = (dmsArray: any, ref: string) => {
        if (!dmsArray || dmsArray.length !== 3) return null;
        const getVal = (x: any) => typeof x.numerator !== 'undefined' ? x.numerator / x.denominator : Number(x);
        let d = getVal(dmsArray[0]);
        let m = getVal(dmsArray[1]);
        let s = getVal(dmsArray[2]);
        let dd = d + m / 60 + s / 3600;
        if (ref === "S" || ref === "W") dd *= -1;
        return dd;
    };

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const findClosestLight = (lat: number, lng: number) => {
        try {
            setGpsLat(lat);
            setGpsLng(lng);
            if (!lightsDict || lightsDict.length === 0) {
                console.warn("lightsDict empty, cannot match GPS");
                return;
            }
            let minLightId = "";
            let minD = Infinity;
            for (let l of lightsDict) {
                let lLat = parseFloat(l["緯度Latitude"]);
                let lLng = parseFloat(l["經度Longitude"]);
                if (!isNaN(lLat) && !isNaN(lLng)) {
                    let d = getDistance(lat, lng, lLat, lLng);
                    if (d < minD) {
                        minD = d;
                        minLightId = l["原路燈號碼"]?.trim() || "";
                    }
                }
            }
            if (minLightId) {
                setGpsLightId(minLightId);
            }
        } catch (err) {
            console.error("Error in findClosestLight:", err);
        } finally {
            setIsLocating(false);
        }
    };

    const handleManualGPS = () => {
        if ("geolocation" in navigator) {
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition((pos) => {
                findClosestLight(pos.coords.latitude, pos.coords.longitude);
                setTimeout(() => alert("已成功更新GPS並尋找最近路燈！"), 100);
            }, (err) => {
                setIsLocating(false);
                setTimeout(() => alert("無法取得位置，請確認是否允許網頁存取 GPS。"), 100);
            }, { enableHighAccuracy: true, timeout: 5000 });
        } else {
            alert("您的瀏覽器不支援定位功能。");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'pre' | 'post') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const tempUrl = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = tempUrl;
        link.download = `${type === 'pre' ? '照片1' : '照片2'}_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(tempUrl);

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;

            if (type === 'pre') setPrePhoto(dataUrl);
            if (type === 'post') setPostPhoto(dataUrl);

            // 只有「照片1」(pre) 才進行 GPS 定對與路燈匹配
            if (type === 'pre') {
                setIsLocating(true);
                
                (EXIF as any).getData(file as any, function (this: any) {
                    try {
                        // 1. 嘗試抓取日期與時間
                        const exifDate = EXIF.getTag(this, "DateTimeOriginal");
                        if (exifDate) {
                            const parts = exifDate.split(" ");
                            if (parts.length === 2) {
                                const d = parts[0].split(":");
                                const t = parts[1].split(":");
                                if (d.length === 3 && t.length === 3) {
                                    setRDate(`${d[0]}-${d[1]}-${d[2]}T${t[0]}:${t[1]}`);
                                }
                            }
                        }

                        // 2. 嘗試抓取 GPS
                        const latArray = EXIF.getTag(this, "GPSLatitude");
                        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                        const lngArray = EXIF.getTag(this, "GPSLongitude");
                        const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

                        let exifLat: number | null = null;
                        let exifLng: number | null = null;
                        if (latArray && latRef && lngArray && lngRef) {
                            exifLat = convertDMSToDD(latArray, latRef);
                            exifLng = convertDMSToDD(lngArray, lngRef);
                        }

                        if (exifLat !== null && exifLng !== null) {
                            console.log("[Photo] Using EXIF GPS");
                            findClosestLight(exifLat, exifLng);
                            return;
                        }

                        // 3. 照片無 GPS，立刻檢查剛才預抓的座標
                        if (lastKnownLoc.current) {
                            console.log("[Photo] No EXIF, using pre-fetched GPS");
                            findClosestLight(lastKnownLoc.current.lat, lastKnownLoc.current.lng);
                        } else {
                            // 最後一招：重新發起定位 (通常此時使用者還在操作，可能會有 Toast 或提示)
                            console.warn("[Photo] No GPS data available yet.");
                            setIsLocating(false);
                            // 不擋住畫面，只在背景抓抓看
                            preFetchLocation();
                        }
                    } catch (e) {
                        console.error("EXIF parsing error:", e);
                        setIsLocating(false);
                    }
                });
            }
            // 「照片2」(post) 僅作為圖片存檔，不讀取任何 EXIF (GPS 或時間)
        };
        reader.readAsDataURL(file);
    };

    const startSmoothClimb = (startP: number, maxP: number, speed: number) => {
        let current = startP;
        clearInterval(smoothIntervalRef.current);
        smoothIntervalRef.current = setInterval(() => {
            if (current < maxP) {
                let step = (maxP - current) * 0.05;
                current += step < 0.01 ? 0.01 : step;
                setUploadProgress(current);
                setUploadText(current.toFixed(1) + "%");
            } else {
                clearInterval(smoothIntervalRef.current);
            }
        }, speed);
    };

    const compress = (b: string): Promise<string> => {
        return new Promise(res => {
            let i = new Image();
            i.src = b;
            i.onload = () => {
                let c = document.createElement("canvas"), w = i.width, h = i.height, m = 1024;
                if (w > h && w > m) { h *= m / w; w = m; }
                else if (h > m) { w *= m / h; h = m; }
                c.width = w; c.height = h;
                c.getContext("2d")?.drawImage(i, 0, 0, w, h);
                res(c.toDataURL("image/jpeg", 0.7));
            };
        });
    };

    const handleUpload = async () => {
        if (!prePhoto && !postPhoto) return alert("請至少上傳一張照片");
        if (!gpsLightId) return alert("請先給定或確認抓取到的路燈編號");

        setIsUploading(true);
        setUploadTitle("📤 正在處理資料");
        setUploadProgress(0);
        setUploadText("0.0%");

        // 原圖上傳，保留 EXIF 資訊
        let a = prePhoto || "";
        setUploadProgress(25); setUploadText("25%");

        let b = postPhoto || "";
        setUploadProgress(50); setUploadText("50%");

        setUploadTitle("🚀 資料傳送中...");
        startSmoothClimb(50.1, 98.5, 150);

        try {
            await fetch(SURVEY_SCRIPT_URL, {
                method: "POST",
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateStr: rDate,
                    lightId: gpsLightId,
                    lat: gpsLat,
                    lng: gpsLng,
                    photo1: a,
                    photo2: b
                })
            });

            clearInterval(smoothIntervalRef.current);
            setUploadProgress(100.0);
            setUploadText("100.0%");
            setUploadTitle("✅ 儲存成功");
            setTimeout(() => {
                alert("上傳成功！資料已寫入推算表。");
                setPrePhoto(null);
                setPostPhoto(null);
                setGpsLightId("");
                setIsUploading(false);
            }, 800);
        } catch (err) {
            clearInterval(smoothIntervalRef.current);
            alert("上傳失敗，請檢查網路後重試。");
            setIsUploading(false);
        }
    };

    const isComplete = prePhoto || postPhoto;

    return (
        <div className="repair-report-container">
            <button onClick={onBack} className="report-back-btn">
                <ChevronLeft className="w-5 h-5" /> 返回
            </button>
            <div className="nav-bar-report"><div className="nav-title-report">路燈基座調查</div></div>

            <div className={`report-content ${isUploading ? 'report-lock' : ''}`} id="page">
                <div className="report-card">
                    <label className="report-label">GPS抓取路燈號碼</label>
                    {gpsLat && gpsLng && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                            📍 經緯度: {gpsLat.toFixed(6)}, {gpsLng.toFixed(6)}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            className="report-input-field"
                            placeholder={isLocating ? "⏳ 正在抓取位置..." : "將從照片中自動抓取最相近路燈"}
                            value={gpsLightId}
                            onChange={(e) => setGpsLightId(e.target.value)}
                            style={{ margin: 0, border: isLocating ? '2px solid #a855f7' : undefined }}
                        />
                        <button
                            className="bg-purple-100 text-purple-600 px-3 rounded-lg font-bold text-sm whitespace-nowrap flex-shrink-0 active:bg-purple-200"
                            onClick={handleManualGPS}
                            style={{ margin: 0 }}
                            title="若照片無 GPS 或抓取不到，可點擊此按鈕抓取現在位置"
                        >
                            📍重新定位
                        </button>
                    </div>
                    <label className="report-label" style={{ marginTop: '1rem' }}>調查時間</label>
                    <input
                        type="datetime-local"
                        className="report-input-field"
                        value={rDate}
                        onChange={(e) => setRDate(e.target.value)}
                    />
                </div>

                <div id="photoContainer">
                    <div className="report-photo-card">
                        <div className="report-photo-header">
                            <div>📸 基座照片上傳</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`report-status-badge ${isComplete ? 'status-complete' : 'status-incomplete'}`}>
                                    {isComplete ? '已拍照' : '未拍照'}
                                </span>
                            </div>
                        </div>
                        <div className="report-photo-body">
                            <div className="comparison-grid">
                                <div>
                                    <div className="comp-label">照片1 (維修前)</div>
                                    <div className="report-upload-box" onClick={() => !prePhoto && handlePick(`f-pre`)}>
                                        {!prePhoto ? (
                                            <div className="report-upload-icon">照片上傳📷</div>
                                        ) : (
                                            <>
                                                <button className="report-remove-btn" onClick={(e) => { e.stopPropagation(); setPrePhoto(null); }}>✕</button>
                                                <img src={prePhoto} alt="pre" />
                                            </>
                                        )}
                                    </div>
                                    {!prePhoto && (
                                        <button className="report-cam-btn" onClick={() => handleCam(`f-pre`)}>📸 拍照上傳</button>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        id={`f-pre`}
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'pre')}
                                    />
                                </div>
                                <div>
                                    <div className="comp-label">照片2 (維修後)</div>
                                    <div className="report-upload-box" onClick={() => !postPhoto && handlePick(`f-post`)}>
                                        {!postPhoto ? (
                                            <div className="report-upload-icon">照片上傳📷</div>
                                        ) : (
                                            <>
                                                <button className="report-remove-btn" onClick={(e) => { e.stopPropagation(); setPostPhoto(null); }}>✕</button>
                                                <img src={postPhoto} alt="post" />
                                            </>
                                        )}
                                    </div>
                                    {!postPhoto && (
                                        <button className="report-cam-btn" onClick={() => handleCam(`f-post`)}>📸 拍照上傳</button>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        id={`f-post`}
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'post')}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="report-btn-submit" onClick={handleUpload}>確認上傳存檔</button>
            </div>

            <div className={`report-upload-mask ${!isUploading ? 'hidden' : ''}`}>
                <div className="report-upload-box-ui">
                    <div className="report-upload-title">{uploadTitle}</div>
                    <div className="report-progress-bar">
                        <div className="report-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <div className="report-progress-text">{uploadText}</div>
                </div>
            </div>
        </div>
    );
}
