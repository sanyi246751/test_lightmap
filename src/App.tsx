/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import StreetLightMap from './components/StreetLightMap';
import ReplaceLightView from './components/ReplaceLightView';
import { StreetLightData } from './types';
import { MapPin, Wrench, Settings } from 'lucide-react';

export type UserRole = 'officer' | 'maintenance' | 'admin' | null;

export default function App() {
  console.log("[App] Component initialized");
  const [role, setRole] = useState<UserRole>(null);
  const [currentPage, setCurrentPage] = useState<'map' | 'replace'>('map');
  const [lights, setLights] = useState<StreetLightData[]>([]);
  const [villageData, setVillageData] = useState<any>(null);

  useEffect(() => {
    // 確保路徑處理正確，BASE_URL 通常包含 /test_lightmap/
    const baseUrl = import.meta.env.BASE_URL || '/';
    const geojsonUrl = `${baseUrl}/data/Sanyi_villages.geojson`.replace(/\/+/g, '/');

    console.log("[App] Attempting to fetch village data from:", geojsonUrl);

    fetch(geojsonUrl)
      .then(res => {
        console.log("[App] Fetch response status:", res.status, res.statusText);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText} at ${geojsonUrl}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data.features) {
          console.log("[App] Village data loaded! Features:", data.features.length);
          setVillageData(data);
        } else {
          console.error("[App] Invalid GeoJSON format:", data);
        }
      })
      .catch(err => {
        console.error("[App] CRITICAL: Failed to load village data!", err);
        // 如果載入失敗，提供一個後門或警告，讓開發者知道是檔案路徑問題
        if (window.location.hostname === 'localhost') {
          console.warn("[App] TIP: On localhost, make sure public/data/Sanyi_villages.geojson exists.");
        }
      });

    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'maintenance' || roleParam === 'admin' || roleParam === 'officer') {
      setRole(roleParam as UserRole);
    }
  }, []);

  // 處理身分選擇並更新網址
  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    if (selectedRole) {
      const url = new URL(window.location.href);
      url.searchParams.set('role', selectedRole);
      window.history.pushState({}, '', url);
    }
  };

  // 如果還沒設定身分，就顯示選單
  if (role === null) {
    return (
      <div className="h-screen w-screen bg-[#FFF9F2] flex flex-col items-center justify-center p-6 text-slate-700 font-sans">
        <h1 className="text-3xl font-extrabold text-[#FF8C69] mb-8">三義鄉公所路燈系統</h1>
        <div className="flex flex-col gap-4 w-full max-w-sm">

          <button
            onClick={() => handleRoleSelect('officer')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-sky-100 text-sky-500 rounded-2xl"><MapPin className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">承辦人員</div>
              <div className="text-sm text-slate-400 font-medium">路燈編號查詢系統、查看待修清單、路燈通報系統</div>
            </div>
          </button>

          <button
            onClick={() => handleRoleSelect('maintenance')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-emerald-100 text-emerald-500 rounded-2xl"><Wrench className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">維修人員</div>
              <div className="text-sm text-slate-400 font-medium">查看待修清單、路燈編號查詢系統</div>
            </div>
          </button>

          <button
            onClick={() => handleRoleSelect('admin')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-orange-100 text-[#FF8C69] rounded-2xl"><Settings className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">管理單位</div>
              <div className="text-sm text-slate-400 font-medium">全部</div>
            </div>
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      {currentPage === 'map' ? (
        <StreetLightMap
          villageData={villageData}
          role={role}
          onNavigateToReplace={(data) => {
            if (role === 'admin') {
              setLights(data);
              setCurrentPage('replace');
            }
          }}
        />
      ) : (
        <ReplaceLightView
          lights={lights}
          villageData={villageData}
          onBack={() => setCurrentPage('map')}
        />
      )}
    </div>
  );
}
