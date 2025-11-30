import {
    Item,
    getAllItems,
    addItem,
    clearDB,
} from "./indexedDB";
// import { playBeepSound } from "./sound";

import { registerSW } from "virtual:pwa-register"


registerSW({
    onNeedRefresh() {
        alert("新しいバージョンがあります。画面を更新してください。")
    }
})


// Check barcode detector
if (!("BarcodeDetector" in window)) {
    alert("このブラウザは Barcode Detector をサポートしていません");
}

const detector = new (window as any).BarcodeDetector({
    formats: ["codabar"]
});
if (!detector) {
    alert("このブラウザは Barcode Detector をサポートしていません");
}


// バーコード読み取り間隔 (msec)
const intervalTime = 500;


//学籍番号を取得する正規表現
// （codabarのスタート、ストップ文字に挟まれた6桁の数字）
const matchStr = /^[A-D](\d{6})[A-D]$/;

// 時刻のフォーマット
const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});


// 初期設定のグローバル変数
let stream: MediaStream | null = null;
let detectTimer: number | null = null;
let scanning: boolean = false;
let lastText: string = "";



///////////////////////////////////////
// elements
///////////////////////////////////////

// div
const elemDivInitial = <HTMLElement>document.getElementById("initial")!;
const elemDivScan = <HTMLElement>document.getElementById("scan")!;

// initial
const elemHeader = <HTMLElement>document.getElementById("header")!;
const elemScanBtn = <HTMLInputElement>document.getElementById("scan-btn")!;
const elemClearBtn = <HTMLInputElement>document.getElementById("clear-btn")!;

// scan
const elemStartBtn = <HTMLInputElement>document.getElementById("start-btn")!;
const elemBackBtn = <HTMLInputElement>document.getElementById("back-btn")!;
const elemVideo = <HTMLVideoElement>document.getElementById("video")!;
const canvas = document.createElement("canvas");
const ctx = <CanvasRenderingContext2D>canvas.getContext("2d")!;

// result (item number and list)
const elemItemNumber = <HTMLElement>document.getElementById("item-number")!;
const elemResultList = <HTMLElement>document.getElementById("result-list")!;



///////////////////////////////////////
// コールバック関数の設定
///////////////////////////////////////
elemScanBtn.addEventListener("click", callbackScanBtn);
elemClearBtn.addEventListener("click", callbackClearBtn);

elemStartBtn.addEventListener("click", callbackStartBtn);
elemBackBtn.addEventListener("click", callbackBackBtn);



///////////////////////////////////////
// change state of UI
///////////////////////////////////////
function setUIState(state: string): void {
    if (state === "initial") {
        // initial
        elemDivInitial.style.display = "block";
        elemHeader.style.display = "block";
        elemScanBtn.style.display = "block";
        elemClearBtn.style.display = "block";
        // other
        elemDivScan.style.display = "none";
        // show item number and list
        showItemNumber();
        showResultList();
    } else if (state === "scan") {
        // scan
        elemDivScan.style.display = "block";
        elemStartBtn.style.display = "inline";
        elemBackBtn.style.display = "inline";
        elemVideo.style.display = "none";
        // other
        elemDivInitial.style.display = "none";
        // result list
        elemResultList.innerHTML = "";
    } else if (state === "send") {
        ;
    }
}


///////////////////////////////////////
// コールバック関数
///////////////////////////////////////

// スキャン画面ボタン
function callbackScanBtn(): void {
    setUIState("scan");
};


// 戻るボタン
function callbackBackBtn(): void {
    setUIState("initial");
};


// スキャン開始・スキャン停止ボタン
async function callbackStartBtn() {
    if (!scanning) {
        // Start
        scanning = true;
        elemStartBtn.textContent = "スキャン停止";
        elemBackBtn.disabled = true;
        elemBackBtn.style.backgroundColor = "gray";
        elemVideo.style.display = "block";
        startVideo(intervalTime);
    } else {
        // Stop
        scanning = false;
        elemStartBtn.textContent = "スキャン開始";
        elemBackBtn.disabled = false;
        elemBackBtn.style.backgroundColor = "#007bff";
        elemVideo.style.display = "none";
        stopVideo();
    }
};


// 結果クリアボタン
async function callbackClearBtn(): Promise<void> {
    const result = confirm("保持データを消去しますか？");
    if (!result) return;

    await clearDB();  // IndexedDB 全削除
    lastText = "";    // 内部状態リセット

    // 画面の反映
    await showItemNumber();
    elemResultList.innerHTML = "";
}



///////////////////////////////////////
// カメラ、バーコード検出
///////////////////////////////////////

// カメラ起動 & バーコード検出
async function startVideo(intervalTime: number) {
    stream = await navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: { facingMode: "environment" }
        });
    elemVideo.srcObject = stream;

    // 映像が利用可能になるまで待つ
    elemVideo.onloadedmetadata = () => {
        elemVideo.play();  // 念のため
    };

    // 映像が実際に表示開始されるイベント
    elemVideo.onplaying = () => {
        // 以前の detectTimer をクリア
        if (detectTimer !== null) {
            clearInterval(detectTimer);
        }
        detectTimer = window.setInterval(detectBarcode, intervalTime);
        detectBarcode();  // バーコード検出
    };
};


// カメラ停止
function stopVideo(): void {
    if (detectTimer !== null) {
        clearInterval(detectTimer);
        detectTimer = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // video 要素を完全リセット
    elemVideo.pause();
    elemVideo.srcObject = null;
    elemVideo.removeAttribute("src"); // 念のため
    elemVideo.load();                 // video の状態を初期化
}


// バーコード検出
async function detectBarcode() {
    if (!('BarcodeDetector' in window)) return;
    const crop = getCropRect(elemVideo);

    const SCAN_W = 640;
    const SCAN_H = 320;   // アスペクト比 2:1 に合わせる

    canvas.width = SCAN_W;
    canvas.height = SCAN_H;

    ctx.drawImage(
      elemVideo,
      crop.sx, crop.sy, crop.sw, crop.sh,
      0, 0, SCAN_W, SCAN_H
    );

    const codes = await detector.detect(canvas);
    if (codes.length > 0) {
        analyzeBarcode(codes[0].rawValue);
    }
}


function getCropRect(video: HTMLVideoElement) {
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const elemW = video.clientWidth;
    const elemH = video.clientHeight;

    const videoRatio = videoW / videoH;
    const elemRatio = elemW / elemH;

    let sx, sy, sw, sh;

    if (videoRatio > elemRatio) {
        // 横に広いので左右をカット
        sw = videoH * elemRatio;
        sh = videoH;
        sx = (videoW - sw) / 2;
        sy = 0;
    } else {
        // 縦に長いので上下をカット
        sw = videoW;
        sh = videoW / elemRatio;
        sx = 0;
        sy = (videoH - sh) / 2;
    }

    return { sx, sy, sw, sh };
}


///////////////////////////////////////
// バーコード解析
//   スタート文字[A-D]とストップ文字[A-D]の中に含まれる6桁の数字を取得
//     => 6桁の数字が学籍番号
///////////////////////////////////////
async function analyzeBarcode(code: string): Promise<void> {
    if (code === lastText) return;

    const match = code.match(matchStr);
    if (!match) {
        alert("無効なバーコードです");
        return;
    }
    const id = match[1];

    // タイムスタンプ作成
    const now = new Date();
    const parts = formatter.formatToParts(now);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const timeStr = `${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`;

    // 登録 & 画面表示
    const barcodeData: Item = {
        id: id,
        timestamp: timeStr
    };
    await addItem(barcodeData);  // IndexedDBに保存
    addResultItem(barcodeData);  // 画面に表示
    await showItemNumber();
    // playBeepSound(100);       // 100 msec
    navigator.vibrate(100);      // 100 msec
    lastText = code;             // 二重読み取り防止
}



///////////////////////////////////////
// 結果の表示
///////////////////////////////////////

// 読み取った ID, timestamp の表示
function addResultItem(item: Item): void {
    const { id, timestamp } = item;

    const resultItem = document.createElement("div");
    resultItem.className = "result-item";
    resultItem.textContent = `ID: ${id} (timestamp ${timestamp})`;
    elemResultList.insertBefore(resultItem, elemResultList.firstChild);
}


// IndexedDBに登録されたデータ数の表示
async function showItemNumber(): Promise<void> {
  const items = await getAllItems(); // 全件取得

  const unique = new Set(items.map(i => i.id)).size;
  const total = items.length;

  elemItemNumber.textContent = `登録 ${unique}件（合計 ${total}件）`;
}


// IndexedDBに登録された全データの表示（unique ID）
async function showResultList(): Promise<void> {
    // IndexedDB から全件取得
    const items = await getAllItems();

    // sort (1) id → (2) timestamp
    const sorted = [...items].sort((a, b) => {
        // (1) compare id (数値として比較)
        const idCompare = Number(a.id) - Number(b.id);
        if (idCompare !== 0) return idCompare;

        // (2) compare timestamp (文字列 → ISO形式のため文字比較でOK)
        if (a.timestamp < b.timestamp) return -1;
        if (a.timestamp > b.timestamp) return 1;
        return 0;
    });

    // ユニーク id（先頭の1件のみ）
    const unique = sorted.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
    );

    // HTML に表示
    let str = "";
    for (const dict of unique) {
        str += `${dict.id}: ${dict.timestamp}<br>`;
    }
    elemResultList.innerHTML = str;
}



///////////////////////////////////////
// Initialization
///////////////////////////////////////
document.addEventListener("DOMContentLoaded", async () => {
    setUIState("initial");
    showItemNumber();
    showResultList();
});

