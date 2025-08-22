class ModernSlotMachine {
  constructor(){
    // ====== 新增：集中管理圖示與轉輪資料 ======
    this.ICONS = {
      ALERT: '⚠️',
      CLOSE: '✕',
      TITLE: '🎰',
      HOWTO: '🎮',
      ERROR: '❌'
    };
    this.REEL_SET = [
      ['💰','📈','🚀','💎','⭐','🎯','🔥','💝'],
      ['🎲','🎊','🌟','💫','🎈','🎭','🎪','🎨'],
      ['🏆','🎖️','👑','💰','🎯','⚡','🔮','🎁'],
    ];

    // ====== 你的既有設定 ======
    this.BACKEND_URL = 'http://localhost:5000/api/stock';
    this.isSpinning = false;
    this.reels = ['reel1','reel2','reel3'];
    this.spinDuration = 3000;
    this.resultElement = document.getElementById('result');
    this.machineEl = document.getElementById('slotMachine');
    this.itemHeight = null; // 延遲測量
    this.isIOS = this.detectIOS();
    this.isMobile = this.detectMobile();

    // ====== 新增：把 Emoji 與 Alert 內容從 JS 注入 ======
    this.injectStaticUI();    // 標題/說明/Alert 文案
    this.renderAllReels();    // 三個轉輪內容

    this.setupEventListeners();
    this.initializeAfterLoad();  // 等待字體與 layout 穩定再量測
  }

  // ---------- UI 注入 ----------
  injectStaticUI(){
    // 標題：補上 🎰（先去掉舊圖示避免重複）
    const titleEl = document.querySelector('.title');
    if (titleEl){
      const plain = titleEl.textContent.replace(/^\s*🎰\s*/,'').trim();
      titleEl.textContent = `${this.ICONS.TITLE} ${plain}`;
    }

    // 操作說明：補上 🎮
    const instructionsEl =
      document.querySelector('.instructions-text') ||
      document.querySelector('.instructions p');
    if (instructionsEl){
      const base = '點擊機台任意處或按空白鍵抽取幸運股票';
      instructionsEl.textContent = `${this.ICONS.HOWTO} ${base}`;
    }

    // Mock Alert：用 JS 放入 ⚠️ 文案與 ✕ 按鈕
    const alertEl = document.querySelector('.mock-alert');
    if (alertEl){
      alertEl.innerHTML = `
        <span class="mock-alert-text">
          ${this.ICONS.ALERT} 本頁僅供開發測試，非正式上線內容
        </span>
        <button class="mock-alert-close" aria-label="關閉提醒" type="button">${this.ICONS.CLOSE}</button>
      `;
      const closeBtn = alertEl.querySelector('.mock-alert-close');
      closeBtn?.addEventListener('click', () => {
        // 你 CSS 要有 .mock-alert--hidden（見下方 CSS）
        alertEl.classList.add('mock-alert--hidden');
      });
    }
  }

  renderAllReels(){
    this.reels.forEach((id, idx) => this.renderReel(id, this.REEL_SET[idx]));
  }
  renderReel(reelId, items){
    const reel = document.getElementById(reelId);
    if (!reel) return;
    // 先清空，避免 HTML 本來就有塞東西導致重複
    reel.innerHTML = items.map(ch => `<div class="slot-item">${ch}</div>`).join('');
  }

  // ---------- 你的原本邏輯（量測 / 對齊 / 動畫 / 後端） ----------
  detectIOS(){
    const p = navigator.platform || '';
    const ua = navigator.userAgent || '';
    const iOSLike = /iPad|iPhone|iPod/.test(p) || (/Mac/.test(p) && navigator.maxTouchPoints > 1);
    return iOSLike || /iPhone|iPad|iPod/.test(ua);
  }
  detectMobile(){
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  }
  async initializeAfterLoad(){
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });
    setTimeout(() => { this.measureAndSetupHeights(); }, 200);
    window.addEventListener('resize', () => {
      setTimeout(() => { this.measureAndSetupHeights(); }, 100);
    });
  }
  measureAndSetupHeights(){
    const firstItem = document.querySelector('.slot-item');
    if(!firstItem) return;
    const rect = firstItem.getBoundingClientRect();
    let measuredHeight = rect.height;
    if(this.isMobile){
      measuredHeight = Math.round(measuredHeight);
    } else {
      const dpr = window.devicePixelRatio || 1;
      measuredHeight = Math.round(measuredHeight * dpr) / dpr;
    }
    this.itemHeight = measuredHeight;
    this.snapAllReels();
  }
  snapValueToStep(value, step){
    if (!step || step <= 0) return 0;
    const absValue = Math.abs(value);
    let steps = Math.round(absValue / step);
    let snapped = -(steps * step);
    if(this.isMobile && this.isIOS){
      const dpr = window.devicePixelRatio || 1;
      snapped = -Math.round(Math.abs(snapped) * dpr) / dpr;
    } else if(!this.isMobile){
      const dpr = window.devicePixelRatio || 1;
      if(dpr !== 1){
        snapped = -Math.round(Math.abs(snapped) * dpr) / dpr;
      } else {
        snapped = -Math.round(Math.abs(snapped));
      }
    } else {
      snapped = -Math.round(Math.abs(snapped));
    }
    return snapped;
  }
  setupEventListeners(){
    this.machineEl.addEventListener('click',()=>this.spin());
    this.machineEl.addEventListener('pointerdown', ()=> this.machineEl.style.transform = 'scale(.995)');
    this.machineEl.addEventListener('pointerup',   ()=> this.machineEl.style.transform = '');
    this.machineEl.addEventListener('pointercancel',()=> this.machineEl.style.transform = '');
    document.addEventListener('keydown',(e)=>{
      if(e.code==='Space' && !this.isSpinning){ e.preventDefault(); this.spin(); }
    });
  }
  async spin(){
    if(this.isSpinning || !this.itemHeight) return;
    this.isSpinning = true;
    this.machineEl.classList.add('spinning');
    this.resultElement.innerHTML=`<span class="loading">${this.ICONS.TITLE} 抽取幸運股票中...</span>`;
    this.startSpinAnimation();
    try{
      const result = await this.callBackendAPI();
      setTimeout(()=>{
        this.stopSpinAnimation();
        this.showResult(result);
        this.machineEl.classList.remove('spinning');
        this.isSpinning=false;
      }, this.spinDuration);
    }catch(error){
      setTimeout(()=>{
        this.stopSpinAnimation();
        this.showError(error.message);
        this.machineEl.classList.remove('spinning');
        this.isSpinning=false;
      }, this.spinDuration);
    }
  }
  startSpinAnimation(){
    this.reels.forEach((id,idx)=>{
      const reel=document.getElementById(id);
      const items = reel.children.length;
      reel.classList.add('spin-animation');
      setTimeout(()=>{
        reel.classList.remove('spin-animation');
        // 強制重繪確保動畫停止
        reel.style.transform = reel.style.transform;
        void reel.offsetHeight;
        const randomIndex = Math.floor(Math.random() * items);
        const targetY = -(randomIndex * this.itemHeight);
        const snappedY = this.snapValueToStep(targetY, this.itemHeight);
        requestAnimationFrame(()=>{
          reel.style.transform = `translate3d(0, ${snappedY}px, 0)`;
        });
      }, 2000 + idx*300);
    });
  }
  stopSpinAnimation(){
    this.reels.forEach(id=>{
      const reel = document.getElementById(id);
      reel.classList.remove('spin-animation');
    });
  }
  snapAllReels(){
    if (!this.itemHeight) return;
    this.reels.forEach((id) => {
      const reel = document.getElementById(id);
      const currentY = this.getTranslateY(reel);
      if(Number.isFinite(currentY)){
        const snappedY = this.snapValueToStep(currentY, this.itemHeight);
        reel.style.transform = `translate3d(0, ${snappedY}px, 0)`;
      } else {
        reel.style.transform = `translate3d(0, 0px, 0)`;
      }
    });
  }
  getTranslateY(el){
    const style = getComputedStyle(el);
    const transform = style.transform;
    if(!transform || transform === 'none') return 0;
    const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
    if(matrix3d){
      const values = matrix3d[1].split(',').map(parseFloat);
      return values[13] || 0;
    }
    const matrix2d = transform.match(/matrix\(([^)]+)\)/);
    if(matrix2d){
      const values = matrix2d[1].split(',').map(parseFloat);
      return values[5] || 0;
    }
    const translate3d = transform.match(/translate3d\(([^)]+)\)/);
    if(translate3d){
      const values = translate3d[1].split(',').map(v => parseFloat(v.trim()));
      return values[1] || 0;
    }
    return 0;
  }
  async callBackendAPI(){
    try{
      const response=await fetch(this.BACKEND_URL,{ method:'GET', headers:{ 'Content-Type':'application/json' }});
      if(!response.ok) throw new Error(`後端連線失敗 (${response.status})`);
      return await response.json();
    }catch(e){
      return this.getSimulatedResult();
    }
  }
  getSimulatedResult(){
    const single=['2330 台積電','2317 鴻海','2454 聯發科'];
    const multi=[
      '2330 台積電\n2317 鴻海\n2454 聯發科',
      '2412 中華電\n1301 台塑\n2881 富邦金\n2882 國泰金',
      '2303 聯電\n2002 中鋼\n1216 統一\n2308 台達電\n2379 瑞昱\n3008 大立光'
    ];
    const options=[...single,...multi];
    return options[Math.floor(Math.random()*options.length)];
  }
  showResult(result){
    let text;
    if(typeof result==='string'){ text=result; }
    else if(Array.isArray(result)){
      text=result.map(s=> typeof s==='string'?s : (s.code&&s.name?`${s.code} ${s.name}`:JSON.stringify(s))).join('\n');
    }else if(result && result.code&&result.name){ text=`${result.code} ${result.name}`; }
    else{ text=JSON.stringify(result,null,2); }
    const lines=text.split('\n').length;
    if(lines>10) this.resultElement.style.fontSize='clamp(12px,2.6vw,16px)';
    else if(lines>6) this.resultElement.style.fontSize='clamp(13px,2.8vw,18px)';
    else if(lines>3) this.resultElement.style.fontSize='clamp(14px,3vw,20px)';
    else this.resultElement.style.fontSize='var(--result-fs)';
    this.resultElement.innerHTML=`<span class="success">${text}</span>`;
    this.animateResult();
  }
  showError(msg){
    this.resultElement.innerHTML=`<span class="error">${this.ICONS.ERROR} 連線錯誤：${msg}</span>`;
  }
  animateResult(){
    this.resultElement.classList.add('success');
    setTimeout(()=>this.resultElement.classList.remove('success'),1200);
  }
}

// 啟動
document.addEventListener('DOMContentLoaded',()=>{
  new ModernSlotMachine();
  const m = document.querySelector('.slot-machine');
  m.style.opacity='0';
  m.style.transform += ' translateY(40px)';
  setTimeout(()=>{
    m.style.transition='all 600ms cubic-bezier(0.25,0.46,0.45,0.94)';
    m.style.opacity='1';
    m.style.transform = m.style.transform.replace(' translateY(40px)','');
  },100);
  const alertEl = document.querySelector('.mock-alert');

const setAlertHeight = () => {
  const h = alertEl ? Math.ceil(alertEl.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty('--alert-h', `${h}px`);
};

setAlertHeight();
/* iOS Safari 會因為位址列收展改變 viewport，高度要補算 */
window.addEventListener('resize', () => setTimeout(setAlertHeight, 50), { passive: true });
window.addEventListener('orientationchange', () => setTimeout(setAlertHeight, 300), { passive: true });

/* 文字換行或你改文案都能即時更新 */
if (window.ResizeObserver && alertEl) {
  new ResizeObserver(setAlertHeight).observe(alertEl);
}

});
document.addEventListener('DOMContentLoaded', () => {
  const alertEl  = document.querySelector('.mock-alert');
  const footerEl = document.querySelector('.copyright');

  const setAlertHeight = () => {
    const h = alertEl ? Math.ceil(alertEl.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--alert-h', `${h}px`);
  };

  const setFooterHeight = () => {
    const fh = footerEl ? Math.ceil(footerEl.getBoundingClientRect().height) : 0;

    // iOS Safari 會因為底部工具列收展改變可視高度，抓額外需要的安全空間
    const vv = window.visualViewport;
    const extra = vv ? Math.max(0, window.innerHeight - vv.height) : 0;

    document.documentElement.style.setProperty('--footer-h', `${fh + extra + 12}px`);
  };

  const recalcAll = () => { setAlertHeight(); setFooterHeight(); };

  recalcAll();
  window.addEventListener('resize', () => setTimeout(recalcAll, 50), { passive:true });
  window.addEventListener('orientationchange', () => setTimeout(recalcAll, 300), { passive:true });

  if (window.ResizeObserver){
    alertEl  && new ResizeObserver(recalcAll).observe(alertEl);
    footerEl && new ResizeObserver(recalcAll).observe(footerEl);
  }
});

// footer 年份維持
(function(){
  const y = new Date().getFullYear();
  const el = document.getElementById('foot-year');
  if (el) el.textContent = y;
})();
