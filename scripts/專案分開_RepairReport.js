/**
 * 檔案：專案分開_RepairReport.gs
 * 功能：維修回報系統 - 後端處理邏輯
 */

var REPAIR_SHEET_NAME = "回復表-路燈查修-升冪";
var REPAIR_PHOTO_FOLDER_ID = "1vZ_8tB8TKxrjNUSlIqLTXhkF2AOmpb1m";

/**
 * 處理「未查修」的清單讀取
 */
function handleRepairReportDoGet(e) {
    try {
        var sheet = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID).getSheetByName(REPAIR_SHEET_NAME);
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
        return returnJson(options);
    } catch (err) {
        return ContentService.createTextOutput("Error: " + err.toString());
    }
}

/**
 * 處理維修結果回報
 */
function handleRepairReportDoPost(p) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        var ss = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID);
        var sheet = ss.getSheetByName(REPAIR_SHEET_NAME);
        var folder = DriveApp.getFolderById(REPAIR_PHOTO_FOLDER_ID);
        var row = parseInt(p.row);

        // 1. 處理日期格式
        var finalDate = p.dateStr.replace(/-/g, "/");
        sheet.getRange(row, 9).setValue(finalDate);

        // 2. 備註
        sheet.getRange(row, 12).setValue(p.note);

        // 3. 處理多組前/後照片
        if (p.photos && p.photos.length > 0) {
            p.photos.forEach(function (pair, index) {
                var startCol = 10 + (index * 2);
                if (startCol >= 12) startCol += 1; // 避開備註欄 L(12)

                var groupNum = "第" + (index + 1) + "組";
                var idNum = "編號" + p.nameB;
                var timeStamp = Utilities.formatDate(new Date(), "GMT+8", "yyyyMMddHHmmss");

                if (pair.pre) {
                    var fileNamePre = timeStamp + groupNum + idNum + "前.jpg";
                    saveRepairFile(pair.pre, folder, sheet, row, startCol, fileNamePre);
                }
                if (pair.post) {
                    var fileNamePost = timeStamp + groupNum + idNum + "後.jpg";
                    saveRepairFile(pair.post, folder, sheet, row, startCol + 1, fileNamePost);
                }
            });
        }

        SpreadsheetApp.flush();
        return returnJson({ status: "success" });
    } catch (err) {
        return returnJson({ status: "error", message: err.toString() });
    } finally {
        lock.releaseLock();
    }
}

/**
 * 輔助函式：維修照片存檔與 HYPERLINK 寫入
 */
function saveRepairFile(b64, folder, sheet, row, col, filename) {
    var parts = b64.split(",");
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, "image/jpeg", filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    var formula = '=HYPERLINK("https://drive.google.com/file/d/' + fileId + '/view", IMAGE("https://drive.google.com/uc?export=view&id=' + fileId + '"))';
    sheet.getRange(row, col).setFormula(formula);
}
