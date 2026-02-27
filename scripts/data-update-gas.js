/**
 * 專案 B：路燈資料升級系統 (GAS)
 * 功能：
 * 1. 更新「路燈位置參考」中的現有路燈座標。
 * 2. 新增路燈時，根據村里代碼自動生成下一個 5 位數編號。
 * 3. 自動依據路燈編號對「路燈位置參考」進行升冪排序。
 * 4. 記錄所有變更至「路燈置換資料」歷史清單。
 */

function doPost(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var refSheet = ss.getSheetByName("路燈位置參考");
    var historySheet = ss.getSheetByName("路燈置換資料");

    // 初始化工作表 (如果不存在)
    if (!historySheet) {
        historySheet = ss.insertSheet("路燈置換資料");
        historySheet.appendRow(["時間", "路燈編號", "緯度Latitude", "經度Longitude", "備註"]);
    }

    try {
        var payload = JSON.parse(e.postData.contents);
        var targetId = payload.id;
        var lat = payload.lat;
        var lng = payload.lng;
        var type = payload.type; // "new" 或 "update"
        var villageCode = payload.villageCode; // 例如 "01" (廣盛村)

        var now = new Date();
        var formattedDate = (now.getFullYear() - 1911) + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + (now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes());

        if (type === "new" && villageCode) {
            // --- 自動編號邏輯 ---
            var lastId = findLastIdForVillage(refSheet, villageCode);
            var nextIdNum = parseInt(lastId) + 1;
            // 補足五位數 (例如 01050)
            targetId = String(nextIdNum).padStart(5, '0');

            // 新增至參考表
            refSheet.appendRow(["'" + targetId, lat, lng]);
        } else {
            // --- 更新現有座標邏輯 ---
            var dataRange = refSheet.getRange(1, 1, refSheet.getLastRow(), 1).getValues();
            var found = false;
            for (var i = 0; i < dataRange.length; i++) {
                if (String(dataRange[i][0]).trim() === String(targetId).trim()) {
                    refSheet.getRange(i + 1, 2, 1, 2).setValues([[lat, lng]]);
                    found = true;
                    break;
                }
            }
            if (!found) {
                // 如果沒找到但又是 update，保險起見還是新增
                refSheet.appendRow(["'" + targetId, lat, lng]);
            }
        }

        // --- 自動排序 ---
        // 依據第一欄 (路燈編號) 升冪排序
        var lastRow = refSheet.getLastRow();
        if (lastRow > 1) {
            refSheet.getRange(2, 1, lastRow - 1, 3).sort({ column: 1, ascending: true });
        }

        // --- 寫入歷史紀錄 ---
        historySheet.appendRow([
            formattedDate,
            "'" + targetId,
            lat,
            lng,
            payload.note || (type === "new" ? "新設路燈" : "座標更新")
        ]);

        return ContentService.createTextOutput("Success ID: " + targetId).setMimeType(ContentService.MimeType.TEXT);

    } catch (error) {
        return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
}

/**
 * 尋找指定村里的最後一個編號
 */
function findLastIdForVillage(sheet, villageCode) {
    var data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    var maxId = villageCode + "000"; // 預設起點，例如 01000

    for (var i = 0; i < data.length; i++) {
        var id = String(data[i][0]).trim();
        if (id.startsWith(villageCode) && id.length === 5) {
            if (parseInt(id) > parseInt(maxId)) {
                maxId = id;
            }
        }
    }
    return maxId;
}
