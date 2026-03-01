/**
 * 路燈維修回報系統 - 後端 Google Apps Script (GAS)
 * 存放位置：scripts/repair-report-gas.js
 * 
 * 功能：
 * 1. doGet: 讀取「回復表-路燈查修-升冪」中「未查修」的清單供前端下拉選單選擇。
 * 2. doPost: 接收前端傳回的維修日期、備註與多組照片，並將照片上傳至 Google Drive 後於試算表內建立超連結。
 */

var SPREADSHEET_ID = "1z6LgYfHXVrxP8bFz2pHtexkJZgg1lle_FhiQMt71mqs";
var SHEET_NAME = "回復表-路燈查修-升冪";
var FOLDER_ID = "1vZ_8tB8TKxrjNUSlIqLTXhkF2AOmpb1m";

function doGet(e) {
    try {
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
        var data = sheet.getDataRange().getValues();
        var options = [];
        var tz = Session.getScriptTimeZone();

        // 從第二列開始讀取 (索引 1)
        for (var i = 1; i < data.length; i++) {
            // 檢查 H 欄 (索引 7) 是否為 "未查修"
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
        return ContentService.createTextOutput(JSON.stringify(options)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput("Error: " + err.toString());
    }
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        var p = JSON.parse(e.postData.contents);

        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var sheet = ss.getSheetByName(SHEET_NAME);
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var row = parseInt(p.row);

        // 1. 處理日期格式 (寫入試算表 I 欄)
        var finalDate = p.dateStr.replace(/-/g, "/");
        sheet.getRange(row, 9).setValue(finalDate);

        // 2. 處理檔名用的時間戳記
        var now = new Date();
        var timeStamp = Utilities.formatDate(now, "GMT+8", "yyyyMMddHHmmss");

        // 3. 寫入 L 欄：維修說明 (備註)
        sheet.getRange(row, 12).setValue(p.note);

        // 4. 處理多組前/後對比照片
        if (p.photos && p.photos.length > 0) {
            p.photos.forEach(function (pair, index) {
                // 計算起始欄位：J 為 10，L 為 12 (須避開備註欄)
                var startCol = 10 + (index * 2);
                if (startCol >= 12) startCol += 1;

                var groupNum = "第" + (index + 1) + "組";
                var idNum = "編號" + p.nameB;

                // 儲存維修前照片
                if (pair.pre) {
                    var fileNamePre = timeStamp + groupNum + idNum + "前.jpg";
                    saveFile(pair.pre, folder, sheet, row, startCol, fileNamePre);
                }
                // 儲存維修後照片
                if (pair.post) {
                    var fileNamePost = timeStamp + groupNum + idNum + "後.jpg";
                    saveFile(pair.post, folder, sheet, row, startCol + 1, fileNamePost);
                }
            });
        }

        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

/**
 * 輔助函式：將 Base64 圖片轉為檔案存至雲端硬碟，並在試算表插入超連結與圖片預覽
 */
function saveFile(b64, folder, sheet, row, col, filename) {
    var parts = b64.split(",");
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, "image/jpeg", filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // 建立 HYPERLINK 搭配 IMAGE 函式，讓試算表直接看到縮圖
    var formula = '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
    sheet.getRange(row, col).setFormula(formula);
}
