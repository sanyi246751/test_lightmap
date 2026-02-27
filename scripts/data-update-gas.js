/**
 * 專案 B：路燈資料升級系統 (GAS) - 照片支援版
 * 功能：
 * 1. doPost: 修改總表、新增、刪除、復原，並支援 base64 照片上傳至 Drive。
 * 2. doGet: 直接回傳歷史紀錄 JSON。
 */

var TARGET_SPREADSHEET_ID = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var PHOTO_FOLDER_ID = "12EyNHWGxC2qCchRA6EuCVHNPJgiOYiym";

/**
 * 前端 GET 進入點：獲取歷史紀錄
 */
function doGet(e) {
    try {
        var ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
        var historySheet = ss.getSheetByName("路燈置換資料");
        if (!historySheet) return returnJson([]);

        var lastRow = historySheet.getLastRow();
        if (lastRow < 2) return returnJson([]);

        // 抓取最後 100 筆資料 (含照片連結在第 9 欄)
        var startRow = Math.max(2, lastRow - 99);
        var numRows = lastRow - startRow + 1;
        var data = historySheet.getRange(startRow, 1, numRows, 9).getValues();

        var results = data.map(function (row) {
            return {
                "時間": row[0],
                "路燈編號": String(row[1]).replace(/'/g, ''),
                "原緯度": row[2],
                "原經度": row[3],
                "新緯度": row[4],
                "新經度": row[5],
                "操作類型": row[6],
                "備註": row[7],
                "照片連結": row[8] || ""
            };
        });

        return returnJson(results.reverse()); // 最新的在前

    } catch (error) {
        return returnJson({ error: error.toString() });
    }
}

function returnJson(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 前端 POST 進入點：執行操作
 */
function doPost(e) {
    try {
        var ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
        var refSheetName = "路燈位置參考";
        var historySheetName = "路燈置換資料";

        var refSheet = ss.getSheetByName(refSheetName) || ss.insertSheet(refSheetName);
        var historySheet = ss.getSheetByName(historySheetName) || ss.insertSheet(historySheetName);

        // 初始化標題 (增加照片連結攔)
        if (refSheet.getLastRow() === 0) {
            refSheet.appendRow(["原路燈號碼", "緯度Latitude", "經度Longitude"]);
        }

        var headerRow = ["修改時間", "路燈編號", "原本緯度", "原本經度", "更新緯度", "更新經度", "異動類型", "備註", "照片連結"];
        if (historySheet.getLastRow() === 0) {
            historySheet.appendRow(headerRow);
        } else {
            historySheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
        }

        var payload = JSON.parse(e.postData.contents);
        var action = payload.action || "update";
        var targetId = String(payload.id).replace(/'/g, '').trim();

        var now = new Date();
        var formattedDate = (now.getFullYear() - 1911) + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + (now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes());

        if (action === "delete") {
            var timeToMatch = payload.time;
            var lastHRow = historySheet.getLastRow();
            if (lastHRow > 1) {
                var hData = historySheet.getRange(2, 1, lastHRow - 1, 2).getValues();
                for (var i = 0; i < hData.length; i++) {
                    if (String(hData[i][0]).trim() === String(timeToMatch).trim() && String(hData[i][1]).replace(/'/g, '').trim() === String(targetId).trim()) {
                        historySheet.deleteRow(i + 2);
                        return ContentService.createTextOutput("Success: Deleted").setMimeType(ContentService.MimeType.TEXT);
                    }
                }
            }
            return ContentService.createTextOutput("Error: Record not found").setMimeType(ContentService.MimeType.TEXT);
        }

        // 新增：刪除路燈整列功能
        if (action === "deleteLight") {
            var lastRowRef = refSheet.getLastRow();
            if (lastRowRef > 0) {
                var dataRef = refSheet.getRange(1, 1, lastRowRef, 1).getValues();
                for (var k = 0; k < dataRef.length; k++) {
                    if (String(dataRef[k][0]).trim() === targetId) {
                        var oldLat = refSheet.getRange(k + 1, 2).getValue();
                        var oldLng = refSheet.getRange(k + 1, 3).getValue();
                        refSheet.deleteRow(k + 1);

                        // 記錄到歷史
                        historySheet.appendRow([
                            formattedDate,
                            targetId,
                            oldLat,
                            oldLng,
                            "",
                            "",
                            "刪除路燈",
                            payload.note || "手動刪除整列",
                            ""
                        ]);
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

        // 處理照片上傳
        var photoUrl = "";
        if (payload.image) {
            photoUrl = saveImageToDrive(payload.image, targetId + "_" + Date.now());
        }

        var safeLat = lat;
        var safeLng = lng;
        var safeBeforeLat = beforeLat;
        var safeBeforeLng = beforeLng;

        if (action === "new" && villageCode) {
            var lastId = findLastIdForVillage(refSheet, villageCode);
            var nextIdNum = parseInt(lastId) + 1;
            targetId = String(nextIdNum).padStart(5, '0');
            refSheet.appendRow([targetId, safeLat, safeLng]);
            note = "新設路燈 (" + (payload.villageName || "未知村里") + ")";
        } else {
            var lastRow = refSheet.getLastRow();
            var found = false;
            if (lastRow > 0) {
                var dataRange = refSheet.getRange(1, 1, lastRow, 1).getValues();
                for (var j = 0; j < dataRange.length; j++) {
                    if (String(dataRange[j][0]).trim() === targetId) {
                        refSheet.getRange(j + 1, 2, 1, 2).setValues([[safeLat, safeLng]]);
                        found = true;
                        break;
                    }
                }
            }
            if (!found && action !== "restore") {
                refSheet.appendRow([targetId, safeLat, safeLng]);
            }
        }

        // 寫入歷史紀錄
        historySheet.appendRow([
            formattedDate,
            targetId,
            safeBeforeLat,
            safeBeforeLng,
            safeLat,
            safeLng,
            action === "restore" ? "恢復原始值" : (action === "new" ? "新增" : "手動更正"),
            note,
            photoUrl
        ]);

        // 最後執行排序
        var finalLastRow = refSheet.getLastRow();
        if (finalLastRow > 1) {
            refSheet.getRange(2, 1, finalLastRow - 1, 3).sort({ column: 1, ascending: true });
        }

        return ContentService.createTextOutput("Success: " + targetId).setMimeType(ContentService.MimeType.TEXT);

    } catch (error) {
        return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
}

/**
 * 將 Base64 圖片存儲至 Google Drive
 */
function saveImageToDrive(base64Data, fileName) {
    try {
        var decoded = Utilities.base64Decode(base64Data.split(',')[1]);
        var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName + ".jpg");
        var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
    } catch (e) {
        return "Upload Error: " + e.toString();
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
            if (parseInt(id) > parseInt(maxId)) maxId = id;
        }
    }
    return maxId;
}

function testConnection() {
    var ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    Logger.log("連接成功: " + ss.getName());
}
