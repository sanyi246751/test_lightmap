export const SHEET_ID = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
export const SHEET_NAME = "路燈位置參考";
export const CHECK_SHEET_NAME = "回復表-路燈查修-升冪";

export const SHEET_URL = `https://opensheet.vercel.app/${SHEET_ID}/${encodeURIComponent(SHEET_NAME)}`;
export const CHECK_SHEET_URL = `https://opensheet.vercel.app/${SHEET_ID}/${encodeURIComponent(CHECK_SHEET_NAME)}`;

// Map data reads directly from Google Sheets. The opensheet proxy can be
// paused, which otherwise makes every lamp lookup appear to be missing.
const googleSheetQueryUrl = (sheetName: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheetName)}`;

export const STREETLIGHT_GVIZ_URL = googleSheetQueryUrl(SHEET_NAME);
export const REPAIR_GVIZ_URL = googleSheetQueryUrl(CHECK_SHEET_NAME);

export const DEFAULT_CENTER: [number, number] = [24.4126, 120.6845];
export const DEFAULT_ZOOM = 14;
export const HISTORY_SHEET_NAME = "路燈置換資料";
export const HISTORY_SHEET_URL = `https://opensheet.vercel.app/${SHEET_ID}/${encodeURIComponent(HISTORY_SHEET_NAME)}`;
export const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzqfgPQXPFz3RiZ9w5XpqX043kEnzGnw5YEXkXGDdvvKc_-HAoCvIDfOOKrC4j3jXqK/exec";

export const VILLAGE_GEOJSON_URL = "/test_lightmap/data/Sanyi_villages.geojson";
