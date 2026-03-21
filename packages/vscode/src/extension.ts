import * as vscode from 'vscode';

let activityCounter = 0;
let lastActivityTime = 0;

export function activate(context: vscode.ExtensionContext) {
  // 사이드바 Webview 등록
  const provider = new FarmViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('claudeFarmer.farmView', provider)
  );

  // 명령어 등록
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openFarm', () => {
      vscode.commands.executeCommand('claudeFarmer.farmView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeFarmer.openWeb', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://claudefarmer.com'));
    })
  );

  // 에디터 입력 감지 → 활동 카운트
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const now = Date.now();
      if (now - lastActivityTime < 3000) return; // 3초 디바운스
      lastActivityTime = now;

      const charCount = e.contentChanges.reduce((sum, change) => sum + change.text.length, 0);
      activityCounter += charCount;

      // 일정 활동량마다 webview에 알림
      if (activityCounter > 200) {
        activityCounter = 0;
        provider.notifyActivity();
      }
    })
  );

  // 터미널 활동 감지
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTerminal(() => {
      provider.notifyActivity();
    })
  );
}

export function deactivate() {}

class FarmViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml();
  }

  notifyActivity() {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({ type: 'activity' });
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1d27;
      color: #e5e7eb;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 12px;
      padding: 8px;
    }
    canvas {
      width: 100%;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border-radius: 6px;
      border: 1px solid #2a2d3a;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-top: 8px;
    }
    .stat {
      background: #232736;
      border: 1px solid #2a2d3a;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
    }
    .stat-label { opacity: 0.5; font-size: 10px; }
    .stat-value { font-weight: bold; font-size: 14px; }
    .notification {
      background: #232736;
      border: 1px solid #4ade80;
      border-radius: 4px;
      padding: 6px 8px;
      margin-top: 6px;
      font-size: 11px;
      display: none;
    }
    .notification.show { display: block; }
    .actions {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .btn {
      background: #232736;
      border: 1px solid #2a2d3a;
      color: #e5e7eb;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      text-align: center;
    }
    .btn:hover { border-color: #fbbf24; }
    .btn-primary {
      background: #fbbf24;
      color: #000;
      border-color: #fbbf24;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <canvas id="farm" width="256" height="192"></canvas>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">🌾 수확</div>
      <div class="stat-value" id="harvests">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">📦 도감</div>
      <div class="stat-value" id="collection">0/24</div>
    </div>
    <div class="stat">
      <div class="stat-label">💧 물</div>
      <div class="stat-value" id="water">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">🔥 연속</div>
      <div class="stat-value" id="streak">1일</div>
    </div>
  </div>

  <div class="notification" id="notif"></div>

  <div class="actions">
    <button class="btn btn-primary" onclick="openWeb()">🌍 전체 화면 열기</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('farm');
    const ctx = canvas.getContext('2d');
    let frame = 0;
    let crops = [];
    let notifications = [];

    // 간단한 농장 렌더링
    function render() {
      frame++;
      ctx.clearRect(0, 0, 256, 192);

      // 하늘
      const hour = new Date().getHours();
      let skyTop, skyBot;
      if (hour >= 6 && hour < 11) { skyTop = '#FFF3E0'; skyBot = '#FFCCBC'; }
      else if (hour >= 11 && hour < 17) { skyTop = '#B3E5FC'; skyBot = '#E1F5FE'; }
      else if (hour >= 17 && hour < 21) { skyTop = '#F48FB1'; skyBot = '#FFE082'; }
      else { skyTop = '#0D1B2A'; skyBot = '#1B2838'; }

      const grad = ctx.createLinearGradient(0, 0, 0, 48);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 48);

      // 별 (밤)
      if (hour >= 21 || hour < 6) {
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 15; i++) {
          if (frame % 60 < 40 || i % 3 !== 0)
            ctx.fillRect((i * 17 + 5) % 256, (i * 11 + 3) % 45, 1, 1);
        }
      }

      // 땅
      ctx.fillStyle = '#7BC74D';
      ctx.fillRect(0, 48, 256, 144);
      ctx.fillStyle = '#5A9E32';
      for (let x = 0; x < 256; x += 7) {
        for (let y = 48; y < 192; y += 5) {
          ctx.fillRect(x + (y * 3 % 5), y, 1, 1);
        }
      }

      // 흙 영역
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(62, 54, 132, 100);
      ctx.fillStyle = '#6B4E0A';
      for (let x = 62; x < 194; x += 4) {
        for (let y = 54; y < 154; y += 4) {
          ctx.fillRect(x + (y * 2 % 3), y + (x % 2), 1, 1);
        }
      }

      // 격자
      ctx.fillStyle = '#6B4E0A';
      for (let i = 0; i <= 4; i++) {
        ctx.fillRect(64 + i * 32 - 1, 54, 1, 100);
        ctx.fillRect(62, 56 + i * 24 - 1, 132, 1);
      }

      // 작물 (데모)
      const cropColors = ['#FF8C00', '#EF4444', '#FACC15', '#FF6B81', '#F97316', '#FBB6CE'];
      for (let i = 0; i < crops.length && i < 16; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const cx = 72 + col * 32;
        const cy = 60 + row * 24;
        const stage = crops[i].stage;

        ctx.fillStyle = '#7BC74D';
        const h = 2 + stage * 3;
        ctx.fillRect(cx + 7, cy + 16 - h, 2, h);
        if (stage > 0) ctx.fillRect(cx + 5, cy + 16 - h - 1, 6, 2);
        if (stage >= 3) {
          ctx.fillStyle = cropColors[i % cropColors.length];
          ctx.fillRect(cx + 5, cy + 16 - h, 5, 4);
        }
      }

      // 캐릭터
      const bounce = frame % 40 < 20 ? 0 : -1;
      const charX = 210;
      const charY = 80 + bounce;
      ctx.fillStyle = '#5C3A1E';
      ctx.fillRect(charX, charY, 6, 3);
      ctx.fillStyle = '#FFD5B8';
      ctx.fillRect(charX + 1, charY + 3, 4, 3);
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(charX + 1, charY + 4, 1, 1);
      ctx.fillRect(charX + 4, charY + 4, 1, 1);
      ctx.fillStyle = '#6C9BD2';
      ctx.fillRect(charX, charY + 6, 6, 4);
      ctx.fillStyle = '#5B7A9E';
      ctx.fillRect(charX + 1, charY + 10, 2, 2);
      ctx.fillRect(charX + 3, charY + 10, 2, 2);
    }

    // 활동 감지 시 작물 추가/성장
    function onActivity() {
      // 성장
      for (const crop of crops) {
        if (crop.stage < 3) {
          crop.stage++;
          break;
        }
      }

      // 빈 칸에 심기
      if (crops.length < 16 && Math.random() < 0.3) {
        crops.push({ stage: 0 });
        showNotification('🌱 새 씨앗을 심었어요!');
      }

      // 수확
      const ready = crops.filter(c => c.stage >= 3);
      if (ready.length > 0) {
        const idx = crops.indexOf(ready[0]);
        crops.splice(idx, 1);
        showNotification('🌾 수확 완료! 가챠 아이템 획득!');
      }
    }

    function showNotification(msg) {
      const el = document.getElementById('notif');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3000);
    }

    function openWeb() {
      vscode.postMessage({ type: 'openWeb' });
    }

    // VSCode → Webview 메세지 수신
    window.addEventListener('message', (e) => {
      if (e.data.type === 'activity') {
        onActivity();
      }
    });

    // 초기 작물
    crops = [
      { stage: 3 }, { stage: 2 }, { stage: 1 }, { stage: 0 },
      { stage: 3 }, { stage: 1 },
    ];

    // 렌더 루프
    setInterval(render, 80);
  </script>
</body>
</html>`;
  }
}
