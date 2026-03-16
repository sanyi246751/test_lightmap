/**
 * 路燈基座調查 - 後端 Google Apps Script (GAS)
 * 存放位置：scripts/base-survey-gas.js
 */

var TARGET_SPREADSHEET = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var PHOTO_FOLDER_ID = "1dZGLDkbCCdb32yTMKc2Ded8xzJKjVrpl";
var SHEET_NAME = "路燈基座調查";

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
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
        var newRow = [dateStr, lightId, "", ""];
        sheet.appendRow(newRow);
        var lastRow = sheet.getLastRow();

        sheet.getRange(lastRow, 1, 1, 2).setNumberFormat("@");
        sheet.getRange(lastRow, 1).setValue(dateStr);
        sheet.getRange(lastRow, 2).setValue(lightId);

        if (p.photo1) {
            saveFile(p.photo1, folder, sheet, lastRow, 3, timeStamp + "_基座調查_" + lightId + "_維修前.jpg");
        }
        if (p.photo2) {
            saveFile(p.photo2, folder, sheet, lastRow, 4, timeStamp + "_基座調查_" + lightId + "_維修後.jpg");
        }

        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function saveFile(b64, folder, sheet, row, col, filename) {
    var parts = b64.split(",");
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, "image/jpeg", filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    var formula = '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
    sheet.getRange(row, col).setFormula(formula);
}
