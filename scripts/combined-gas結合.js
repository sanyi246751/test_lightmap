/**
 * 整合版 Google Apps Script - 路燈系統 (路燈資料更新 + 維修回報 + LINE 通知)
 * 整合：data-update-gas.js, repair-report-gas.js, google-apps-script.js
 */

// --- 核心變數設定 --- (請確保這些內容與您的環境一致)
var SPREADSHEET_ID = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var DATA_PHOTO_FOLDER_ID = "12EyNHWGxC2qCchRA6EuCVHNPJgiOYiym"; // 路燈置換照片
var REPAIR_PHOTO_FOLDER_ID = "1vZ_8tB8TKxrjNUSlIqLTXhkF2AOmpb1m"; // 維修回報照片
var ADMIN_SECRET = "XXXXXXXX"; // 路燈資料更正後端金鑰 (務必與前端 ADMIN_PASSWORD 一致)

// 工作表名稱
var SHEET_REF = "路燈位置參考";
var SHEET_HISTORY = "路燈置換資料";
var SHEET_REPAIR = "回復表-路燈查修-升冪";

/**
 * GET 進入點：分發至不同模組
 * 參數使用範例：?service=repair 獲取維修清單，其餘預設獲取置換歷史
 */
function doGet(e) {
    var service = e.parameter.service || e.parameter.type;

    if (service === "repair") {
        return getRepairOptions();
    } else {
        return getHistoryData();
    }
}

/**
 * POST 進入點：分發至不同模組
 * 會根據 payload 內容或參數 service 推斷目標模組
 */
function doPost(e) {
    try {
        var payload = JSON.parse(e.postData.contents);
        var service = e.parameter.service;

        // 判斷邏輯：如果 payload 有 row 或是 service 指定為 repair，則進入維修回報邏輯
        if (service === "repair" || (payload.row && payload.dateStr)) {
            return processRepairReport(payload);
        } else {
            return processDataUpdate(payload);
        }
    } catch (error) {
        return returnText("Error: " + error.toString());
    }
}

// ==========================================
// 模組一：路燈資料升級 (原 data-update-gas.js)
// ==========================================

function getHistoryData() {
    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var historySheet = ss.getSheetByName(SHEET_HISTORY);
        if (!historySheet) return returnJsonResponse([]);

        var lastRow = historySheet.getLastRow();
        if (lastRow < 2) return returnJsonResponse([]);

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

        return returnJsonResponse(results.reverse());
    } catch (error) {
        return returnJsonResponse({ error: error.toString() });
    }
}

function processDataUpdate(payload) {
    // 金鑰驗證
    if (payload.access_token !== ADMIN_SECRET) {
        return returnText("Error: 設備未授權！");
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var refSheet = ss.getSheetByName(SHEET_REF) || ss.insertSheet(SHEET_REF);
    var historySheet = ss.getSheetByName(SHEET_HISTORY) || ss.insertSheet(SHEET_HISTORY);

    // 初始化格式
    if (refSheet.getLastRow() === 0) {
        refSheet.appendRow(["原路燈號碼", "緯度Latitude", "經度Longitude"]);
    }
    refSheet.getRange("A1:C10000").setNumberFormat("@");

    var headerRow = ["修改時間", "路燈編號", "原本緯度", "原本經度", "更新緯度", "更新經度", "異動類型", "備註", "照片連結"];
    if (historySheet.getLastRow() === 0) {
        historySheet.appendRow(headerRow);
    } else {
        historySheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
    }
    historySheet.getRange("A1:I20000").setNumberFormat("@");

    var action = payload.action || "update";
    var targetId = String(payload.id).replace(/'/g, '').trim();
    var now = new Date();
    var formattedDate = (now.getFullYear() - 1911) + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + (now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes());

    // 處理刪除歷史紀錄
    if (action === "delete" || action === "batchDelete") {
        return handleHistoryDeletion(historySheet, payload, action);
    }

    // 處理刪除路燈整列
    if (action === "deleteLight") {
        return handleDeleteLight(refSheet, historySheet, targetId, formattedDate, payload);
    }

    // 處理更新或新增
    var lat = payload.lat;
    var lng = payload.lng;
    var photoUrl = "";
    if (payload.image) {
        photoUrl = saveImageToDrive(payload.image, targetId + "_" + Date.now());
    }

    if (action === "new" && payload.villageCode) {
        targetId = generateNewId(refSheet, payload.villageCode);
        refSheet.appendRow([targetId, String(lat), String(lng)]);
        refSheet.getRange(refSheet.getLastRow(), 1, 1, 3).setNumberFormat("@");
    } else {
        updateRefSheet(refSheet, targetId, lat, lng, action === "restore");
    }

    // 紀錄歷史
    var hData = [
        formattedDate, targetId, String(payload.beforeLat || ""), String(payload.beforeLng || ""),
        String(lat), String(lng),
        action === "restore" ? "恢復原始值" : (action === "new" ? "新增" : "手動更正"),
        payload.note || "", photoUrl
    ];
    historySheet.appendRow(hData);
    historySheet.getRange(historySheet.getLastRow(), 1, 1, hData.length).setNumberFormat("@");

    // 排序
    if (refSheet.getLastRow() > 1) {
        refSheet.getRange(2, 1, refSheet.getLastRow() - 1, 3).sort({ column: 1, ascending: true });
    }

    return returnText("Success: " + targetId);
}

// ==========================================
// 模組二：維修回報系統 (原 repair-report-gas.js)
// ==========================================

function getRepairOptions() {
    try {
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_REPAIR);
        var data = sheet.getDataRange().getValues();
        var options = [];
        var tz = Session.getScriptTimeZone();

        for (var i = 1; i < data.length; i++) {
            if (data[i][7] === "未查修") {
                var dateShow = (data[i][6] instanceof Date) ? Utilities.formatDate(data[i][6], tz, "MM/dd") : data[i][6];
                options.push({
                    row: i + 1,
                    text: "路燈編號 " + data[i][1] + "-已報修" + dateShow + "-列 " + (i + 1),
                    colA: data[i][0],
                    colB: data[i][1]
                });
            }
        }
        return returnJsonResponse(options);
    } catch (err) {
        return returnText("Error: " + err.toString());
    }
}

function processRepairReport(p) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_REPAIR);
        var folder = DriveApp.getFolderById(REPAIR_PHOTO_FOLDER_ID);
        var row = parseInt(p.row);

        sheet.getRange(row, 9).setValue(p.dateStr.replace(/-/g, "/")); // 日期
        sheet.getRange(row, 12).setValue(p.note); // 備註

        var timeStamp = Utilities.formatDate(new Date(), "GMT+8", "yyyyMMddHHmmss");

        if (p.photos && p.photos.length > 0) {
            p.photos.forEach(function (pair, index) {
                var startCol = 10 + (index * 2);
                if (startCol >= 12) startCol += 1;
                var groupNum = "第" + (index + 1) + "組";
                var idNum = "編號" + p.nameB;

                if (pair.pre) saveRepairFile(pair.pre, folder, sheet, row, startCol, timeStamp + groupNum + idNum + "前.jpg");
                if (pair.post) saveRepairFile(pair.post, folder, sheet, row, startCol + 1, timeStamp + groupNum + idNum + "後.jpg");
            });
        }

        SpreadsheetApp.flush();
        return returnJsonResponse({ status: "success" });
    } catch (err) {
        return returnJsonResponse({ status: "error", message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

// ==========================================
// 模組三：LINE Bot 通知 (原 google-apps-script.js)
// ==========================================

function sendToLineBot(e) {
    var rowData = e.values;
    if (!rowData || rowData.length < 2) return;

    var lampNumber = String(rowData[1] || "").trim();
    var faultDescription = rowData[2] || "未註明";
    var reportPerson = rowData[3] || "未提供";
    var phoneNumber = rowData[4] || "未提供";

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var locationSheet = ss.getSheetByName(SHEET_REF);
    var latitude = "", longitude = "", found = false;

    if (locationSheet) {
        var locationData = locationSheet.getDataRange().getValues();
        for (var i = 1; i < locationData.length; i++) {
            if (String(locationData[i][0]).trim() === lampNumber) {
                latitude = locationData[i][1];
                longitude = locationData[i][2];
                found = true;
                break;
            }
        }
    }

    var date = new Date(rowData[0]);
    if (isNaN(date.getTime())) date = new Date();
    var formattedDate = (date.getFullYear() - 1911) + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日 " + (date.getHours() < 12 ? "上午" : "下午") + (date.getHours() % 12 || 12) + "點" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + "分";

    var props = PropertiesService.getScriptProperties();
    var lineToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = props.getProperty('LINE_GROUP_ID') || "Ceafbfbf259f1ce5d3720d19a72fde37f";

    if (!lineToken) return;

    var flexMessage = createLineFlex(lampNumber, formattedDate, faultDescription, reportPerson, phoneNumber, found, latitude, longitude);

    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
        "method": "post",
        "headers": { "Content-Type": "application/json", "Authorization": "Bearer " + lineToken },
        "payload": JSON.stringify({ "to": groupId, "messages": [flexMessage] }),
        "muteHttpExceptions": true
    });
}

// ==========================================
// 輔助函式庫 (Helpers)
// ==========================================

function returnJsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function returnText(msg) {
    return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function saveImageToDrive(base64Data, fileName) {
    var decoded = Utilities.base64Decode(base64Data.split(',')[1]);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName + ".jpg");
    var file = DriveApp.getFolderById(DATA_PHOTO_FOLDER_ID).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
}

function saveRepairFile(b64, folder, sheet, row, col, filename) {
    var bytes = Utilities.base64Decode(b64.split(",")[1]);
    var blob = Utilities.newBlob(bytes, "image/jpeg", filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    var formula = '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
    sheet.getRange(row, col).setFormula(formula);
}

function generateNewId(sheet, villageCode) {
    var data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    var maxId = parseInt(villageCode + "000");
    for (var i = 0; i < data.length; i++) {
        var id = parseInt(String(data[i][0]).trim());
        if (!isNaN(id) && String(id).startsWith(villageCode) && String(id).length === 5) {
            if (id > maxId) maxId = id;
        }
    }
    return String(maxId + 1).padStart(5, '0');
}

function updateRefSheet(sheet, targetId, lat, lng, isRestore) {
    var data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    var found = false;
    for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetId) {
            sheet.getRange(i + 1, 2, 1, 2).setNumberFormat("@").setValues([[String(lat), String(lng)]]);
            found = true;
            break;
        }
    }
    if (!found && !isRestore) {
        sheet.appendRow([targetId, String(lat), String(lng)]);
        sheet.getRange(sheet.getLastRow(), 1, 1, 3).setNumberFormat("@");
    }
}

function handleHistoryDeletion(sheet, payload, action) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnText("Error: History is empty");

    var itemsToDelete = action === "delete" ? [{ id: payload.id, time: payload.time }] : payload.items;
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var rowsToDelete = [];

    for (var i = 0; i < data.length; i++) {
        var rTime = String(data[i][0]).trim();
        var rId = String(data[i][1]).trim();
        for (var m = 0; m < itemsToDelete.length; m++) {
            if (rTime === String(itemsToDelete[m].time).trim() && rId === String(itemsToDelete[m].id).trim()) {
                rowsToDelete.push(i + 2);
                break;
            }
        }
    }
    rowsToDelete.sort(function (a, b) { return b - a; }).forEach(function (r) { sheet.deleteRow(r); });
    return returnText("Success: Deleted " + rowsToDelete.length + " items");
}

function handleDeleteLight(refSheet, historySheet, targetId, date, payload) {
    var data = refSheet.getRange(1, 1, refSheet.getLastRow(), 1).getValues();
    for (var i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetId) {
            var oldLat = refSheet.getRange(i + 1, 2).getValue();
            var oldLng = refSheet.getRange(i + 1, 3).getValue();
            refSheet.deleteRow(i + 1);
            historySheet.appendRow([date, targetId, String(oldLat), String(oldLng), "", "", "刪除路燈", payload.note || "手動刪除", ""]);
            historySheet.getRange(historySheet.getLastRow(), 1, 1, 9).setNumberFormat("@");
            return returnText("Success: Deleted Light " + targetId);
        }
    }
    return returnText("Error: Light not found");
}

function createLineFlex(lampNumber, date, fault, person, phone, found, lat, lng) {
    var contents = [
        { "type": "text", "text": "📢 通知：路燈查修！", "weight": "bold", "size": "xl", "color": "#111111" },
        { "type": "separator", "margin": "md" },
        { "type": "text", "text": "📅 時間：" + date, "size": "md", "margin": "md", "wrap": true },
        { "type": "text", "text": "💡 路燈編號：" + lampNumber, "size": "md", "margin": "md", "weight": "bold", "color": "#1E90FF" },
        { "type": "text", "text": "⚠️ 故障情形：" + fault, "size": "md", "margin": "md", "wrap": true },
        { "type": "text", "text": "👤 通報人：" + person, "size": "md", "margin": "md" },
        { "type": "text", "text": "📞 聯絡電話：" + phone, "size": "md", "margin": "md" },
        { "type": "separator", "margin": "md" }
    ];
    if (found && lat && lng) {
        contents.push({
            "type": "button", "style": "primary", "color": "#1E90FF", "margin": "md",
            "action": { "type": "uri", "label": "查看地圖", "uri": "https://maps.google.com/?q=" + lat + "," + lng }
        });
    }
    return { "type": "flex", "altText": "📢 通知：路燈查修！(" + lampNumber + ")", "contents": { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": contents } } };
}

function testConnection() {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("試算表連接成功: " + ss.getName());
    var folder = DriveApp.getFolderById(DATA_PHOTO_FOLDER_ID);
    Logger.log("雲端硬碟資料夾讀取成功: " + folder.getName());
    var tempFile = folder.createFile("測試權限", "暫存檔", MimeType.PLAIN_TEXT);
    tempFile.setTrashed(true);
    Logger.log("授權測試成功");
}
