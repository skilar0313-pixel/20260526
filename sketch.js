let rainData = null;
let hoveredStationName = null; // 紀錄目前滑鼠在左側面板指向的站名
// 錯誤 413 (Payload Too Large) 表示資料量太大，corsproxy.io 無法處理。
// 改用 allorigins 代理伺服器，並使用 raw 模式通常對處理大型 JSON 資料較穩定。
const proxy = "https://api.allorigins.win/raw?url=";
const apiUrl = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=rdec-key-123-45678-011121314";

// 台北市主要測站經緯度座標對照表 (用於地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
};

// Mappa 地圖設定
const mappa = new Mappa('Leaflet');
let myMap;
let cv;

const options = {
  lat: 25.048,
  lng: 121.53,
  zoom: 11,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

function setup() {
  // 建立全螢幕畫布並與地圖結合
  cv = createCanvas(windowWidth, windowHeight);
  myMap = mappa.tileMap(options);
  myMap.overlay(cv);
  
  // 取得資料
  fetchData();
  
  // 每 1 分鐘自動更新一次
  setInterval(fetchData, 60000);

  // 當地圖變更時重新繪製
  myMap.onChange(draw);
}

function fetchData() {
  // 使用代理伺服器抓取資料
  // 加入 encodeURIComponent 確保網址參數傳遞正確
  loadJSON(proxy + encodeURIComponent(apiUrl), (data) => {
    if (data && data.records) {
      // 相容性處理：部分版本的 API 資料位於 Station 欄位，部分則在 location
      if (Array.isArray(data.records.Station)) {
        rainData = data.records.Station;
      } else if (Array.isArray(data.records.location)) {
        rainData = data.records.location;
      }

      if (rainData) {
        console.log("氣象署資料更新成功，站點數：", rainData.length);
      } else {
        console.warn("API 請求成功但找不到站點列表 (records.Station 或 records.location)");
      }
    } else {
      console.log("資料格式非預期:", data);
    }
  }, (err) => {
    console.error("資料抓取失敗，可能是 API 暫時無回應或代理伺服器限制", err);
  });
}

function draw() {
  // 清除畫布（地圖層在下方，不會被清除）
  clear();
  cursor(ARROW);
  
  let taipeiStations = []; // 用於存放篩選後的台北市資料，方便面板顯示
  let isRainingInTaipei = false;
  
  if (rainData) {
    for (let i = 0; i < rainData.length; i++) {
      let d = rainData[i];
      
      const isTaipei = d.GeoLocation && (d.GeoLocation.CountyName === "臺北市" || d.GeoLocation.CountyName === "台北市");
      if (!isTaipei) continue;

      taipeiStations.push(d);

      let lat, lon;
      if (stationCoords[d.StationName]) {
        lat = stationCoords[d.StationName].lat;
        lon = stationCoords[d.StationName].lon;
      } else if (d.GeoLocation && d.GeoLocation.Coordinates && d.GeoLocation.Coordinates[0]) {
        lat = d.GeoLocation.Coordinates[0].Latitude;
        lon = d.GeoLocation.Coordinates[0].Longitude;
      }

      if (lat && lon) {
        const pos = myMap.latLngToPixel(lat, lon);
        
        let nowRain = parseFloat(d.RainfallElement && d.RainfallElement.Now ? d.RainfallElement.Now.Precipitation : 0);
        if (nowRain < 0) nowRain = 0;
        if (nowRain > 0) isRainingInTaipei = true;
        
        let size = nowRain * 5 + 10;
        
        // 互動效果：如果滑鼠正在左側面板選中此站點，加大直徑
        if (d.StationName === hoveredStationName) {
          size += 20;
        }

        // 根據雨量決定顏色：大於 10mm 紅色，其餘白色
        let markerColor;
        if (nowRain > 10) {
          markerColor = color(255, 0, 0, 180); // 紅色
        } else {
          markerColor = color(255, 255, 255, 200); // 白色
        }

        push();
        fill(markerColor);
        stroke(255);
        strokeWeight(1);
        ellipse(pos.x, pos.y, size, size);

        // 寫上雨量數值
        if (nowRain > 10) {
          fill(255, 0, 0);
        } else {
          fill(255);
          stroke(0);
          strokeWeight(2);
        }
        noStroke();
        textSize(14);
        textStyle(BOLD);
        textAlign(LEFT, CENTER);
        text(`${nowRain} mm`, pos.x + size / 2 + 5, pos.y);
        pop();

        if (dist(mouseX, mouseY, pos.x, pos.y) < size/2 + 5) {
          cursor(HAND);
          fill(0, 220);
          noStroke();
          rect(pos.x + 15, pos.y - 45, 200, 65, 5);
          fill(255);
          textSize(14);
          text(`測站: ${d.StationName}\n行政區: ${d.GeoLocation.TownName || '未知'}\n雨量: ${nowRain} mm`, pos.x + 20, pos.y - 25);
        }
      }
    }
  }

  // 繪製左上角資訊欄
  fill(255, 230);
  noStroke();
  rect(10, 10, 320, 60, 5);
  fill(0);
  textSize(18);
  text("臺北市即時雨量地圖", 20, 32);
  textSize(12);
  text("資料來源：中央氣象署 (僅顯示臺北市測站)", 20, 52);

  // 繪製左側雨量列表面板
  drawSidePanel(taipeiStations);

  // 繪製右上角天氣圖示
  drawWeatherIcon(isRainingInTaipei);
  
  // 繪製顏色說明圖例 (Legend)
  drawLegend();
}

function drawSidePanel(stations) {
  push();
  fill(255, 240);
  noStroke();
  rect(10, 80, 220, windowHeight - 90, 5);
  
  fill(50);
  textStyle(BOLD);
  textSize(14);
  text("各觀測站雨量列表", 20, 105);
  
  textStyle(NORMAL);
  textSize(12);
  
  let startY = 130;
  let lineHeight = 22;
  
  hoveredStationName = null; // 重設，每一幀重新檢查

  for (let i = 0; i < stations.length; i++) {
    let s = stations[i];
    let y = startY + i * lineHeight;
    let rain = parseFloat(s.RainfallElement.Now.Precipitation);
    if (rain < 0) rain = 0;

    // 檢查滑鼠是否在該行站名上
    if (mouseX > 10 && mouseX < 230 && mouseY > y - 15 && mouseY < y + 5) {
      fill(200, 230, 255);
      rect(15, y - 16, 210, lineHeight, 3);
      hoveredStationName = s.StationName;
      cursor(HAND);
    }

    fill(0);
    if (rain > 10) fill(255, 0, 0); // 列表中大於 10mm 也標紅
    text(`${s.StationName}: ${rain} mm`, 25, y);
  }
  pop();
}

function drawWeatherIcon(isRaining) {
  push();
  translate(width - 80, 50);
  noStroke();
  if (isRaining) {
    // 繪製下雨圖示 (簡單藍色雲朵 + 雨滴)
    fill(100, 150, 255);
    ellipse(0, 0, 50, 30);
    ellipse(-15, 10, 30, 20);
    ellipse(15, 10, 30, 20);
    stroke(100, 150, 255);
    strokeWeight(3);
    line(-10, 20, -15, 35);
    line(0, 25, -5, 40);
    line(10, 20, 5, 35);
  } else {
    // 繪製太陽圖示
    fill(255, 200, 0);
    ellipse(0, 0, 45, 45);
    stroke(255, 200, 0);
    strokeWeight(4);
    for (let a = 0; a < TWO_PI; a += PI / 4) {
      let x1 = cos(a) * 28;
      let y1 = sin(a) * 28;
      let x2 = cos(a) * 40;
      let y2 = sin(a) * 40;
      line(x1, y1, x2, y2);
    }
  }
  pop();
}

function drawLegend() {
  push();
  let lx = 10;
  let ly = windowHeight - 110;
  fill(255, 230);
  rect(lx, ly, 150, 60, 5);
  
  // 大於 10mm
  fill(255, 0, 0);
  ellipse(lx + 20, ly + 20, 15, 15);
  fill(0);
  textSize(12);
  text("> 10 mm (大雨)", lx + 40, ly + 25);
  
  // 小於等於 10mm
  fill(255);
  stroke(150);
  ellipse(lx + 20, ly + 45, 12, 12);
  noStroke();
  fill(0);
  text("≤ 10 mm", lx + 40, ly + 50);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
