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

  return (
    <div className="h-screen w-screen overflow-hidden">
      {currentPage === 'map' ? (
        <StreetLightMap
          onNavigateToReplace={(data) => {
            setLights(data);
            setCurrentPage('replace');
          }}
        />
      ) : (
        <ReplaceLightView
          lights={lights}
          onBack={() => setCurrentPage('map')}
        />
      )}
    </div>
  );
}

