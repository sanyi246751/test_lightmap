/**
 * 檔案：專案分開_LineBot.gs
 * 功能：Line Bot 通知系統 - 監聽試算表表單提交
 */

function sendToLineBot(e) {
    // 記錄收到的原始資料
    console.log("收到的表單資料: " + JSON.stringify(e.values));

    const rowData = e.values;
    if (!rowData || rowData.length < 2) return;

    const timestamp = rowData[0];
    const lampNumber = String(rowData[1] || "").trim();
    const faultDescription = rowData[2] || "未註明";
    const reportPerson = rowData[3] || "未提供";
    const phoneNumber = rowData[4] || "未提供";

    // 使用全域 SS_ID 查詢座標
    const ss = SpreadsheetApp.openById(GLOBAL_SPREADSHEET_ID);
    const locationSheet = ss.getSheetByName("路燈位置參考");

    let latitude = "", longitude = "", found = false;

    if (locationSheet) {
        const lastRow = locationSheet.getLastRow();
        if (lastRow > 0) {
            const locationData = locationSheet.getRange(1, 1, lastRow, 3).getValues();
            for (let i = 0; i < locationData.length; i++) {
                if (String(locationData[i][0]).trim() === lampNumber) {
                    latitude = locationData[i][1];
                    longitude = locationData[i][2];
                    found = true;
                    break;
                }
            }
        }
    }

    const mapUrl = found ? `https://maps.google.com/?q=${latitude},${longitude}` : "";

    let date = new Date(timestamp);
    if (isNaN(date.getTime())) date = new Date();
    const minguoYear = date.getFullYear() - 1911;
    const formattedDate = minguoYear + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日 " + (date.getHours() < 12 ? "上午" : "下午") + (date.getHours() % 12 || 12) + "點" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + "分";

    const props = PropertiesService.getScriptProperties();
    const lineToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    const groupId = props.getProperty('LINE_GROUP_ID') || "Ceafbfbf259f1ce5d3720d19a72fde37f";

    if (!lineToken) return;

    const flexMessage = {
        "to": groupId,
        "messages": [{
            "type": "flex",
            "altText": "📢 通知：路燈查修！(" + lampNumber + ")",
            "contents": {
                "type": "bubble",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        { "type": "text", "text": "📢 通知：路燈查修！", "weight": "bold", "size": "xl", "color": "#111111" },
                        { "type": "separator", "margin": "md" },
                        { "type": "text", "text": "📅 時間：" + formattedDate, "size": "md", "margin": "md", "wrap": true },
                        { "type": "text", "text": "💡 路燈編號：" + lampNumber, "size": "md", "margin": "md", "weight": "bold", "color": "#1E90FF" },
                        { "type": "text", "text": "⚠️ 故障情形：" + faultDescription, "size": "md", "margin": "md", "wrap": true },
                        { "type": "text", "text": "👤 通報人：" + reportPerson, "size": "md", "margin": "md" },
                        { "type": "text", "text": "📞 聯絡電話：" + phoneNumber, "size": "md", "margin": "md" },
                        { "type": "separator", "margin": "md" }
                    ]
                }
            }
        }]
    };

    if (found && latitude && longitude) {
        flexMessage.messages[0].contents.body.contents.push({
            "type": "button",
            "style": "primary",
            "color": "#1E90FF",
            "margin": "md",
            "action": { "type": "uri", "label": "查看地圖", "uri": mapUrl }
        });
    }

    const options = {
        "method": "post",
        "headers": { "Content-Type": "application/json", "Authorization": "Bearer " + lineToken },
        "payload": JSON.stringify(flexMessage),
        "muteHttpExceptions": true
    };

    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
}
