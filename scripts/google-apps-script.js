/**
 * Google Apps Script - Line Bot 通知
 * 
 * 此腳本應部署於 Google Apps Script 並設定「提交表單」觸發器。
 * 部署教學：
 * 1. 在 Google 試算表點選「擴充功能」>「Apps Script」。
 * 2. 貼上此程式碼。
 * 3. 在左側「設定」(齒輪圖示) 的「指令碼屬性」中新增：
 *    - LINE_CHANNEL_ACCESS_TOKEN: 您的 LINE Messaging API Token
 *    - LINE_GROUP_ID: 接收通知的群組 ID (預設為 fallback)
 */

function sendToLineBot(e) {
    // 記錄收到的原始資料
    console.log("收到的表單資料: " + JSON.stringify(e.values));

    const rowData = e.values;
    if (!rowData || rowData.length < 2) {
        console.error("無效的表單資料送入");
        return;
    }

    const timestamp = rowData[0];
    const lampNumber = String(rowData[1] || "").trim();
    const faultDescription = rowData[2] || "未註明";
    const reportPerson = rowData[3] || "未提供";
    const phoneNumber = rowData[4] || "未提供";

    // 取得 "路燈位置參考" 工作表進行座標查詢
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const locationSheet = ss.getSheetByName("路燈位置參考");

    let latitude = "", longitude = "", found = false;

    if (locationSheet) {
        const lastRow = locationSheet.getLastRow();
        if (lastRow > 0) {
            const locationData = locationSheet.getRange(1, 1, lastRow, 3).getValues();
            for (let i = 0; i < locationData.length; i++) {
                // 使用字串且去空白比對，避免 0 開頭編號或數字格式問題
                if (String(locationData[i][0]).trim() === lampNumber) {
                    latitude = locationData[i][1];
                    longitude = locationData[i][2];
                    found = true;
                    console.log(`找到路燈編號 ${lampNumber} 的座標: ${latitude}, ${longitude}`);
                    break;
                }
            }
        }
    } else {
        console.warn("找不到名為 '路燈位置參考' 的工作表，將無法提供地圖按鈕。");
    }

    const mapUrl = found ? `https://maps.google.com/?q=${latitude},${longitude}` : "";
    const formattedDate = Utilities.formatDate(new Date(timestamp), "GMT+0800", "yyyy/MM/dd HH:mm");

    // 從 Script Properties 讀取 Token
    const props = PropertiesService.getScriptProperties();
    const lineToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    const groupId = props.getProperty('LINE_GROUP_ID') || "Ceafbfbf259f1ce5d3720d19a72fde37f";

    if (!lineToken) {
        console.error("未設定 LINE_CHANNEL_ACCESS_TOKEN 指令碼屬性，傳送失敗。");
        return;
    }

    // 封裝 Flex Message
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

    // 如果有座標，加入地圖按鈕
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
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + lineToken
        },
        "payload": JSON.stringify(flexMessage),
        "muteHttpExceptions": true // 讓網址提取失敗時仍能取得回應內容
    };

    try {
        const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
        const result = response.getContentText();
        const code = response.getResponseCode();
        console.log(`LINE API 回應代碼: ${code}, 內容: ${result}`);

        if (code !== 200) {
            console.error(`傳送失敗！請檢查 Token 或 Group ID。API 回應: ${result}`);
        }
    } catch (error) {
        console.error("連線到 LINE API 時發生錯誤: " + error.toString());
    }
}

