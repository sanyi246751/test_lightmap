/**
 * 路燈基座調查 - 後端 Google Apps Script (GAS)
 * 存放位置：scripts/base-survey-gas.js
 */

var TARGET_SPREADSHEET = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var PHOTO_FOLDER_ID = "1dZGLDkbCCdb32yTMKc2Ded8xzJKjVrpl";
var SHEET_NAME = "路燈基座調查";

function doGet(e) {
    return ContentService.createTextOutput("GAS 服務運作中，請使用 POST 傳送調查資料。").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        console.log("收到 POST 請求: " + e.postData.contents.substring(0, 100) + "...");
        
        var p = JSON.parse(e.postData.contents);
        var ss = SpreadsheetApp.openById(TARGET_SPREADSHEET);
        var sheet = ss.getSheetByName(SHEET_NAME);
        
        if (!sheet) {
            sheet = ss.insertSheet(SHEET_NAME);
            sheet.appendRow(["調查時間", "GPS抓取路燈號碼", "照片1", "照片2"]);
            sheet.getRange("A1:D1").setFontWeight("bold");
        }

        var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
        var now = new Date();
        var timeStamp = Utilities.formatDate(now, "GMT+8", "yyyyMMddHHmmss");
        
        var dateStr = p.dateStr || "";
        var lightId = p.lightId || "未知";
        
        // 寫入基本資料
        var newRow = [dateStr, lightId, "", ""];
        sheet.appendRow(newRow);
        var lastRow = sheet.getLastRow();

        // 強制設定格式為文字，避免路燈號碼被科學符號化
        sheet.getRange(lastRow, 1, 1, 2).setNumberFormat("@");
        sheet.getRange(lastRow, 1).setValue(dateStr);
        sheet.getRange(lastRow, 2).setValue(lightId);

        console.log("已新增列 " + lastRow + "，準備處理照片");

        if (p.photo1 && p.photo1.length > 50) {
            saveFile(p.photo1, folder, sheet, lastRow, 3, timeStamp + "_基座調查_" + lightId + "_1.jpg");
        }
        if (p.photo2 && p.photo2.length > 50) {
            saveFile(p.photo2, folder, sheet, lastRow, 4, timeStamp + "_基座調查_" + lightId + "_2.jpg");
        }

        SpreadsheetApp.flush();
        console.log("資料上傳成功");
        
        return ContentService.createTextOutput(JSON.stringify({ status: "success", row: lastRow }))
            .setMimeType(ContentService.MimeType.JSON);
            
    } catch (err) {
        console.error("錯誤: " + err.toString());
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function saveFile(b64, folder, sheet, row, col, filename) {
    try {
        var parts = b64.split(",");
        var bytes = Utilities.base64Decode(parts[1]);
        var blob = Utilities.newBlob(bytes, "image/jpeg", filename);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var fileId = file.getId();
        var formula = '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
        sheet.getRange(row, col).setFormula(formula);
    } catch (e) {
        console.warn("照片儲存失敗: " + e.toString());
        sheet.getRange(row, col).setValue("照片上傳失敗: " + e.toString());
    }
}
