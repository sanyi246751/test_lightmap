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
            sheet.appendRow(["調查時間", "GPS抓取路燈號碼", "緯度", "經度", "照片1", "照片2"]);
            sheet.getRange("A1:F1").setFontWeight("bold");
        }

        var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
        var now = new Date();
        var timeStamp = Utilities.formatDate(now, "GMT+8", "yyyyMMddHHmmss");
        
        var dateStr = p.dateStr || "";
        var lightId = p.lightId || "未知";
        var lat = p.lat || "";
        var lng = p.lng || "";
        
        // 寫入基本資料
        var newRow = [dateStr, lightId, lat, lng, "", ""];
        sheet.appendRow(newRow);
        var lastRow = sheet.getLastRow();

        // 強制設定格式為文字，避免路燈號碼被科學符號化，經緯度保持精確
        sheet.getRange(lastRow, 1, 1, 4).setNumberFormat("@");
        sheet.getRange(lastRow, 1).setValue(dateStr);
        sheet.getRange(lastRow, 2).setValue(lightId);
        sheet.getRange(lastRow, 3).setValue(lat);
        sheet.getRange(lastRow, 4).setValue(lng);

        console.log("已新增列 " + lastRow + "，座標: " + lat + "," + lng + "，準備處理照片");

        if (p.photo1 && p.photo1.length > 50) {
            var url1 = saveImageToDrive(p.photo1, lightId + "_基座1_" + Date.now());
            sheet.getRange(lastRow, 5).setValue(url1);
        }
        if (p.photo2 && p.photo2.length > 50) {
            var url2 = saveImageToDrive(p.photo2, lightId + "_基座2_" + Date.now());
            sheet.getRange(lastRow, 6).setValue(url2);
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

/**
 * 參考 data-update-gas.js 的照片存檔方式
 */
function saveImageToDrive(base64Data, fileName) {
    try {
        var decoded = Utilities.base64Decode(base64Data.split(',')[1]);
        var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName + ".jpg");
        var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        // 取得檔案 ID 以建立預覽公式 (維持 IMAGE 預覽功能)
        var fileId = file.getId();
        return '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
    } catch (e) {
        return "Upload Error: " + e.toString();
    }
}
