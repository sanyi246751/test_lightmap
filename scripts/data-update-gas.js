/**
 * 專案 B：路燈資料升級系統 (GAS) - 診斷版
 * 功能：
 * 1. 更新「路燈位置參考」中的現有路燈座標。
 * 2. 新增路燈時，根據村里代碼自動生成下一個 5 位數編號。
 * 3. 自動依序排序並記錄歷史。
 */

function doPost(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var refSheetName = "路燈位置參考";
    var historySheetName = "路燈置換資料";

    var refSheet = ss.getSheetByName(refSheetName);
    var historySheet = ss.getSheetByName(historySheetName);

    // 1. 自動建立缺失的工作表
    if (!refSheet) {
        console.log("找不到 '" + refSheetName + "'，正在自動建立...");
        refSheet = ss.insertSheet(refSheetName);
        refSheet.appendRow(["原路燈號碼", "緯度Latitude", "經度Longitude"]);
    }

    if (!historySheet) {
        console.log("找不到 '" + historySheetName + "'，正在自動建立...");
        historySheet = ss.insertSheet(historySheetName);
        historySheet.appendRow(["時間", "路燈編號", "緯度Latitude", "經度Longitude", "備註"]);
    }

    try {
        var payload = JSON.parse(e.postData.contents);
        console.log("接收到資料:", payload);

        var targetId = payload.id;
        var lat = payload.lat;
        var lng = payload.lng;
        var type = payload.type;
        var villageCode = payload.villageCode;

        var now = new Date();
        var formattedDate = (now.getFullYear() - 1911) + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + (now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes());

        if (type === "new" && villageCode) {
            console.log("執行【新增路燈】流程，村里代碼:", villageCode);
            var lastId = findLastIdForVillage(refSheet, villageCode);
            var nextIdNum = parseInt(lastId) + 1;
            targetId = String(nextIdNum).padStart(5, '0');
            console.log("產生新編號:", targetId);

            refSheet.appendRow(["'" + targetId, lat, lng]);
        } else {
            console.log("執行【座標更新】流程，目標編號:", targetId);
            var lastRow = refSheet.getLastRow();
            var found = false;

            if (lastRow > 0) {
                var dataRange = refSheet.getRange(1, 1, lastRow, 1).getValues();
                for (var i = 0; i < dataRange.length; i++) {
                    if (String(dataRange[i][0]).trim() === String(targetId).trim()) {
                        refSheet.getRange(i + 1, 2, 1, 2).setValues([[lat, lng]]);
                        found = true;
                        console.log("已更新第 " + (i + 1) + " 列資料");
                        break;
                    }
                }
            }

            if (!found) {
                console.warn("找不到編號 " + targetId + "，改為新增一行");
                refSheet.appendRow(["'" + targetId, lat, lng]);
            }
        }

        // --- 自動排序 ---
        var finalLastRow = refSheet.getLastRow();
        if (finalLastRow > 1) {
            refSheet.getRange(2, 1, finalLastRow - 1, 3).sort({ column: 1, ascending: true });
        }

        // --- 寫入歷史紀錄 ---
        historySheet.appendRow([
            formattedDate,
            "'" + targetId,
            lat,
            lng,
            payload.note || (type === "new" ? "新設路燈" : "座標更新")
        ]);

        console.log("流程全部完成");
        return ContentService.createTextOutput("Success: " + targetId).setMimeType(ContentService.MimeType.TEXT);

    } catch (error) {
        console.error("發生錯誤:", error.toString());
        return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
}

function findLastIdForVillage(sheet, villageCode) {
    var lastRow = sheet.getLastRow();
    var maxId = villageCode + "000";

    if (lastRow < 1) return maxId;

    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
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
