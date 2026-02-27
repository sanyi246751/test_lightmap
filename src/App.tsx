/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import StreetLightMap from './components/StreetLightMap';
import ReplaceLightView from './components/ReplaceLightView';
import { StreetLightData } from './types';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'map' | 'replace'>('map');
  const [lights, setLights] = useState<StreetLightData[]>([]);
  const [villageData, setVillageData] = useState<any>(null);

  React.useEffect(() => {
    import('./constants').then(({ VILLAGE_GEOJSON_URL }) => {
      fetch(VILLAGE_GEOJSON_URL)
        .then(res => res.json())
        .then(data => setVillageData(data))
        .catch(err => console.error("Error fetching village data in App:", err));
    });
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      {currentPage === 'map' ? (
        <StreetLightMap
          villageData={villageData}
          onNavigateToReplace={(data) => {
            setLights(data);
            setCurrentPage('replace');
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

