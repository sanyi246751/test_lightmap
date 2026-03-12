/**
 * 檔案：專案分開_DataUpdate.gs
 * 功能：主入口 Router 與路燈資料更新系統
 */

// --- 專案全域變數 (三個 .gs 檔案皆可直接存取) ---
var GLOBAL_SPREADSHEET_ID = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var UPDATE_PHOTO_FOLDER_ID = "12EyNHWGxC2qCchRA6EuCVHNPJgiOYiym";
var ADMIN_SECRET = "XXXXXXXX"; // 務必與前端 ADMIN_PASSWORD 一致

/**
 * 網頁應用程式 GET 入口：獲取歷史紀錄
 */
function doGet(e) {
    // 透過網址參數分流：?api=repair 導向維修清單，否則導向更新紀錄
    if (e.parameter.api === 'repair') {
        return handleRepairReportDoGet(e);
    }
    return handleDataUpdateDoGet(e);
}

/**
 * 網頁應用程式 POST 入口：執行操作
 */
function doPost(e) {
    try {
        var payload = JSON.parse(e.postData.contents);
        // 根據 payload 結構分流：有 row 屬性者導向維修回報，否則導向座標更新
        if (payload.row) {
            return handleRepairReportDoPost(payload);
        }
        return handleDataUpdateDoPost(payload);
    } catch (error) {
        return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
}

// --- 資料更新系統的核心 Logic ---

function handleDataUpdateDoGet(e) {
    try {
        var ss = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID);
        var historySheet = ss.getSheetByName("路燈置換資料");
        if (!historySheet) return returnJson([]);

        var lastRow = historySheet.getLastRow();
        if (lastRow < 2) return returnJson([]);

        var startRow = Math.max(2, lastRow - 99);
        var numRows = lastRow - startRow + 1;
        var data = historySheet.getRange(startRow, 1, numRows, 9).getValues();

        var results = data.map(function (row) {
            var cleanStr = function (val) {
                return String(val || "").replace(/'/g, '').trim();
            };
            return {
                "時間": cleanStr(row[0]),
                "路燈編號": cleanStr(row[1]),
                "原緯度": cleanStr(row[2]),
                "原經度": cleanStr(row[3]),
                "新緯度": cleanStr(row[4]),
                "新經度": cleanStr(row[5]),
                "操作類型": cleanStr(row[6]),
                "備註": cleanStr(row[7]),
                "照片連結": String(row[8] || "")
            };
        });

        return returnJson(results.reverse());

    } catch (error) {
        return returnJson({ error: error.toString() });
    }
}

function handleDataUpdateDoPost(payload) {
    if (payload.access_token !== ADMIN_SECRET) {
        return ContentService.createTextOutput("Error: 設備未授權！").setMimeType(ContentService.MimeType.TEXT);
    }

    var ss = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID);
    var refSheetName = "路燈位置參考";
    var historySheetName = "路燈置換資料";

    var refSheet = ss.getSheetByName(refSheetName) || ss.insertSheet(refSheetName);
    var historySheet = ss.getSheetByName(historySheetName) || ss.insertSheet(historySheetName);

    // 初始化標題與格式
    if (refSheet.getLastRow() === 0) {
        refSheet.appendRow(["原路燈號碼", "緯度Latitude", "經度Longitude"]);
    }
    refSheet.getRange("A1:C10000").setNumberFormat("@");

    var headerRow = ["修改時間", "路燈編號", "原本緯度", "原本經度", "更新緯度", "更新經度", "異動類型", "備註", "照片連結"];
    if (historySheet.getLastRow() === 0) {
        historySheet.appendRow(headerRow);
    }
    historySheet.getRange("A1:I20000").setNumberFormat("@");

    var action = payload.action || "update";
    var targetId = String(payload.id).replace(/'/g, '').trim();

    var now = new Date();
    var formattedDate = (now.getFullYear() - 1911) + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + (now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes());

    if (action === "delete") {
        var timeToMatch = payload.time;
        var lastHRow = historySheet.getLastRow();
        if (lastHRow > 1) {
            var hData = historySheet.getRange(2, 1, lastHRow - 1, 2).getValues();
            for (var i = hData.length - 1; i >= 0; i--) {
                var rowTime = String(hData[i][0]).replace(/'/g, '').trim();
                var rowId = String(hData[i][1]).replace(/'/g, '').trim();
                if (rowTime === String(timeToMatch).replace(/'/g, '').trim() && rowId === String(targetId).trim()) {
                    historySheet.deleteRow(i + 2);
                    return ContentService.createTextOutput("Success: Deleted").setMimeType(ContentService.MimeType.TEXT);
                }
            }
        }
        return ContentService.createTextOutput("Error: Record not found").setMimeType(ContentService.MimeType.TEXT);
    }

    if (action === "batchDelete") {
        var itemsToDelete = payload.items;
        if (!itemsToDelete || !itemsToDelete.length) return returnError("No items provided");
        var lastHRow = historySheet.getLastRow();
        if (lastHRow < 2) return returnError("History is empty");
        var hRange = historySheet.getRange(2, 1, lastHRow - 1, 2);
        var hValues = hRange.getValues();
        var rowsToDelete = [];
        for (var i = 0; i < hValues.length; i++) {
            var rowTime = String(hValues[i][0]).replace(/'/g, '').trim();
            var rowId = String(hValues[i][1]).replace(/'/g, '').trim();
            for (var m = 0; m < itemsToDelete.length; m++) {
                var targetTime = String(itemsToDelete[m].time).replace(/'/g, '').trim();
                var targetIdMatch = String(itemsToDelete[m].id).replace(/'/g, '').trim();
                if (rowTime === targetTime && rowId === targetIdMatch) {
                    rowsToDelete.push(i + 2);
                    break;
                }
            }
        }
        rowsToDelete.sort(function (a, b) { return b - a; });
        for (var n = 0; n < rowsToDelete.length; n++) {
            historySheet.deleteRow(rowsToDelete[n]);
        }
        return ContentService.createTextOutput("Success: Deleted " + rowsToDelete.length + " items").setMimeType(ContentService.MimeType.TEXT);
    }

    if (action === "deleteLight") {
        var lastRowRef = refSheet.getLastRow();
        if (lastRowRef > 0) {
            var dataRef = refSheet.getRange(1, 1, lastRowRef, 1).getValues();
            for (var k = 0; k < dataRef.length; k++) {
                if (String(dataRef[k][0]).trim() === targetId) {
                    var oldLat = refSheet.getRange(k + 1, 2).getValue();
                    var oldLng = refSheet.getRange(k + 1, 3).getValue();
                    refSheet.deleteRow(k + 1);
                    var hRow = historySheet.getLastRow() + 1;
                    var hData = [String(formattedDate), String(targetId), String(oldLat), String(oldLng), "", "", "刪除路燈", payload.note || "手動刪除整列", ""];
                    historySheet.getRange(hRow, 1, 1, hData.length).setNumberFormat("@").setValues([hData]);
                    return ContentService.createTextOutput("Success: Deleted Light " + targetId).setMimeType(ContentService.MimeType.TEXT);
                }
            }
        }
        return ContentService.createTextOutput("Error: Light not found").setMimeType(ContentService.MimeType.TEXT);
    }

    var lat = payload.lat;
    var lng = payload.lng;
    var beforeLat = payload.beforeLat || "";
    var beforeLng = payload.beforeLng || "";
    var villageCode = payload.villageCode;
    var note = payload.note || "";

    var photoUrl = "";
    if (payload.image) {
        photoUrl = saveImageToDrive(payload.image, targetId + "_" + Date.now(), UPDATE_PHOTO_FOLDER_ID);
    }

    var safeLat = String(lat);
    var safeLng = String(lng);
    var safeBeforeLat = String(beforeLat);
    var safeBeforeLng = String(beforeLng);

    if (action === "new" && villageCode) {
        var lastId = findLastIdForVillage(refSheet, villageCode);
        var nextIdNum = parseInt(lastId) + 1;
        targetId = String(nextIdNum).padStart(5, '0');
        var newLastRow = refSheet.getLastRow() + 1;
        var rowRange = refSheet.getRange(newLastRow, 1, 1, 3);
        rowRange.setNumberFormat("@");
        SpreadsheetApp.flush();
        rowRange.setValues([[String(targetId), safeLat, safeLng]]);
        note = "新設路燈 (" + (payload.villageName || "未知村里") + ")";
    } else {
        var lastRow = refSheet.getLastRow();
        var found = false;
        if (lastRow > 0) {
            var dataRange = refSheet.getRange(1, 1, lastRow, 1).getValues();
            for (var j = 0; j < dataRange.length; j++) {
                if (String(dataRange[j][0]).trim() === targetId) {
                    refSheet.getRange(j + 1, 2, 1, 2).setNumberFormat("@").setValues([[safeLat, safeLng]]);
                    found = true;
                    break;
                }
            }
        }
        if (!found && action !== "restore") {
            var newLastRow = refSheet.getLastRow() + 1;
            var rowRange = refSheet.getRange(newLastRow, 1, 1, 3);
            rowRange.setNumberFormat("@");
            SpreadsheetApp.flush();
            rowRange.setValues([[String(targetId), safeLat, safeLng]]);
        }
    }

    var hRow = historySheet.getLastRow() + 1;
    var hData = [String(formattedDate), String(targetId), safeBeforeLat, safeBeforeLng, safeLat, safeLng, action === "restore" ? "恢復原始值" : (action === "new" ? "新增" : "手動更正"), note, photoUrl];
    historySheet.getRange(hRow, 1, 1, hData.length).setNumberFormat("@").setValues([hData]);

    var finalLastRow = refSheet.getLastRow();
    if (finalLastRow > 1) {
        refSheet.getRange(2, 1, finalLastRow - 1, 3).sort({ column: 1, ascending: true });
    }

    return ContentService.createTextOutput("Success: " + targetId).setMimeType(ContentService.MimeType.TEXT);
}

function returnJson(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function saveImageToDrive(base64Data, fileName, folderId) {
    var decoded = Utilities.base64Decode(base64Data.split(',')[1]);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName + ".jpg");
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

function findLastIdForVillage(sheet, villageCode) {
    var lastRow = sheet.getLastRow();
    var maxId = villageCode + "000";
    if (lastRow < 1) return maxId;
    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var i = 0; i < data.length; i++) {
        var id = String(data[i][0]).trim();
        if (id.startsWith(villageCode) && id.length === 5) {
            if (parseInt(id) > parseInt(maxId)) maxId = id;
        }
    }
    return maxId;
}

function testConnection() {
    var ss = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID);
    Logger.log("試算表連接成功: " + ss.getName());
    var folder = DriveApp.getFolderById(UPDATE_PHOTO_FOLDER_ID);
    var tempFile = folder.createFile("測試權限", "這是測試授權的暫存檔", MimeType.PLAIN_TEXT);
    tempFile.setTrashed(true);
}
