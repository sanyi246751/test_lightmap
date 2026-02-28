/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import StreetLightMap from './components/StreetLightMap';
import ReplaceLightView from './components/ReplaceLightView';
import { StreetLightData } from './types';
import { MapPin, Wrench, Settings } from 'lucide-react';

export type UserRole = 'user' | 'maintenance' | 'admin' | null;

export default function App() {
  const [role, setRole] = useState<UserRole>(null);
  const [currentPage, setCurrentPage] = useState<'map' | 'replace'>('map');
  const [lights, setLights] = useState<StreetLightData[]>([]);
  const [villageData, setVillageData] = useState<any>(null);

  useEffect(() => {
    import('./constants').then(({ VILLAGE_GEOJSON_URL }) => {
      fetch(VILLAGE_GEOJSON_URL)
        .then(res => res.json())
        .then(data => setVillageData(data))
        .catch(err => console.error("Error fetching village data in App:", err));
    });

    // 讀取網址參數，例如 ?role=maintenance
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'maintenance' || roleParam === 'admin' || roleParam === 'user') {
      setRole(roleParam as UserRole);
    }
  }, []);

  // 如果還沒設定身分，就顯示選單
  if (role === null) {
    return (
      <div className="h-screen w-screen bg-[#FFF9F2] flex flex-col items-center justify-center p-6 text-slate-700 font-sans">
        <h1 className="text-3xl font-extrabold text-[#FF8C69] mb-8">三義鄉路燈系統</h1>
        <div className="flex flex-col gap-4 w-full max-w-sm">

          <button
            onClick={() => setRole('user')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-sky-100 text-sky-500 rounded-2xl"><MapPin className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">一般民眾</div>
              <div className="text-sm text-slate-400 font-medium">查看地圖、填寫報修</div>
            </div>
          </button>

          <button
            onClick={() => setRole('maintenance')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-emerald-100 text-emerald-500 rounded-2xl"><Wrench className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">維修人員</div>
              <div className="text-sm text-slate-400 font-medium">查看待修清單、導航現場</div>
            </div>
          </button>

          <button
            onClick={() => setRole('admin')}
            className="bg-white p-5 rounded-[2rem] shadow-sm hover:shadow-md border-2 border-slate-100 flex items-center gap-4 transition-all active:scale-95"
          >
            <div className="p-3 bg-orange-100 text-[#FF8C69] rounded-2xl"><Settings className="w-8 h-8" /></div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold">管理單位</div>
              <div className="text-sm text-slate-400 font-medium">使用資料置換系統</div>
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
