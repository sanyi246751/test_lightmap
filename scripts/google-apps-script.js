/**
 * Google Apps Script - Line Bot 通知
 * 
 * 此腳本應部署於 Google Apps Script 並設定「提交表單」觸發器。
 * 建議：不要在程式碼中硬編碼 Token，請使用 PropertiesService。
 */

// --- 建議優化版本 (Suggested Optimized Version) ---
function onFormSubmit(e) {
    // 使用 event object (e) 獲取資料，避免 race condition 並取消 sleep
    const rowData = e.values;
    const lampNumber = rowData[1];
    const faultDescription = rowData[2];
    const reportPerson = rowData[3];
    const phoneNumber = rowData[4];
    const timestamp = rowData[0];

    // 取得 "路燈位置參考" 工作表
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const locationSheet = ss.getSheetByName("路燈位置參考");
    const locationData = locationSheet.getRange("A:C").getValues();

    let latitude = "", longitude = "", found = false;

    for (let i = 0; i < locationData.length; i++) {
        if (locationData[i][0] == lampNumber) {
            latitude = locationData[i][1];
            longitude = locationData[i][2];
            found = true;
            break;
        }
    }

    const mapUrl = found ? `https://maps.google.com/?q=${latitude},${longitude}` : "";
    const date = new Date(timestamp);
    const period = date.getHours() < 12 ? "上午" : "下午";
    const formattedDate = Utilities.formatDate(date, "GMT+8", "yyyy年M月d日 " + period + " h點m分");

    // 安全建議：從 PropertiesService 讀取 Token
    const props = PropertiesService.getScriptProperties();
    const lineToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    const groupId = props.getProperty('LINE_GROUP_ID') || "Ceafbfbf259f1ce5d3720d19a72fde37f";

    if (!lineToken) {
        console.error("未設定 LINE_CHANNEL_ACCESS_TOKEN 屬性");
        return;
    }

    const flexMessage = {
        "to": groupId,
        "messages": [{
            "type": "flex",
            "altText": "📢 通知：路燈查修！",
            "contents": {
                "type": "bubble",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        { "type": "text", "text": "📢 通知：路燈查修！", "weight": "bold", "size": "xl" },
                        { "type": "separator", "margin": "md" },
                        { "type": "text", "text": "📅 時間：" + formattedDate, "size": "md", "margin": "md" },
                        { "type": "text", "text": "💡 路燈編號：" + lampNumber, "size": "md", "margin": "md" },
                        { "type": "text", "text": "⚠️ 故障情形：" + faultDescription, "size": "md", "margin": "md" },
                        { "type": "text", "text": "👤 通報人：" + reportPerson, "size": "md", "margin": "md" },
                        { "type": "text", "text": "📞 聯絡電話：" + phoneNumber, "size": "md", "margin": "md" },
                        { "type": "separator", "margin": "md" }
                    ]
                }
            }
        }]
    };

    if (found) {
        flexMessage.messages[0].contents.body.contents.push({
            "type": "button",
            "style": "primary",
            "color": "#1E90FF",
            "margin": "md",
            "action": { "type": "uri", "label": "查看地圖", "uri": mapUrl }
        });
    } else {
        flexMessage.messages[0].contents.body.contents.push({
            "type": "text", "text": "📍 無參考位置", "size": "md", "color": "#FF0000", "margin": "md"
        });
    }

    const options = {
        "method": "post",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + lineToken
        },
        "payload": JSON.stringify(flexMessage)
    };

    try {
        const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
        console.log("Response: " + response.getContentText());
    } catch (error) {
        console.error("Error: " + error.toString());
    }
}
