class ModernSlotMachine{
      constructor(){
        this.BACKEND_URL = 'http://localhost:5000/api/stock';
        this.isSpinning = false;
        this.reels = ['reel1','reel2','reel3'];
        this.spinDuration = 3000;
        this.resultElement = document.getElementById('result');
        this.machineEl = document.getElementById('slotMachine');
        this.itemHeight = null; // 延遲測量
        this.isIOS = this.detectIOS();
        this.isMobile = this.detectMobile();
        this.setupEventListeners();
        
        // 等待字體和layout穩定後再測量
        this.initializeAfterLoad();
      }

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
        // 等待多個時機點確保layout穩定
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve, { once: true });
          }
        });
        
        // 額外延遲確保字體渲染完成
        setTimeout(() => {
          this.measureAndSetupHeights();
        }, 200);

        window.addEventListener('resize', () => {
          setTimeout(() => {
            this.measureAndSetupHeights();
          }, 100);
        });
      }

      measureAndSetupHeights(){
        const firstItem = document.querySelector('.slot-item');
        if(!firstItem) return;
        
        // 獲取精確的計算高度
        const rect = firstItem.getBoundingClientRect();
        let measuredHeight = rect.height;
        
        // 對不同平台進行微調
        if(this.isMobile){
          // 手機端：取整數像素避免模糊
          measuredHeight = Math.round(measuredHeight);
        } else {
          // 桌面端：考慮DPR進行精確計算
          const dpr = window.devicePixelRatio || 1;
          measuredHeight = Math.round(measuredHeight * dpr) / dpr;
        }
        
        this.itemHeight = measuredHeight;
        console.log(`測量到的item高度: ${this.itemHeight}px, 平台: ${this.isMobile ? '手機' : '桌面'}, DPR: ${window.devicePixelRatio}`);
        
        // 初始化所有轉輪到正確位置
        this.snapAllReels();
      }

      // 改進的對齊算法
      snapValueToStep(value, step){
        if (!step || step <= 0) return 0;
        
        const absValue = Math.abs(value);
        let steps = Math.round(absValue / step);
        let snapped = -(steps * step);
        
        // 根據平台特性進行微調
        if(this.isMobile && this.isIOS){
          // iOS: 使用像素完美對齊
          const dpr = window.devicePixelRatio || 1;
          snapped = -Math.round(Math.abs(snapped) * dpr) / dpr;
        } else if(!this.isMobile){
          // 桌面端: 確保子像素精確度
          const dpr = window.devicePixelRatio || 1;
          if(dpr !== 1){
            snapped = -Math.round(Math.abs(snapped) * dpr) / dpr;
          } else {
            snapped = -Math.round(Math.abs(snapped));
          }
        } else {
          // Android等其他移動端: 簡單取整
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
        this.resultElement.innerHTML='<span class="loading">🎰 抽取幸運股票中...</span>';
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
            
            console.log(`轉輪${idx+1}: 目標位置=${targetY}, 對齊後=${snappedY}, 隨機索引=${randomIndex}`);
            
            // 使用requestAnimationFrame確保渲染時機
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
        
        this.reels.forEach((id, index) => {
          const reel = document.getElementById(id);
          const currentY = this.getTranslateY(reel);
          
          if(Number.isFinite(currentY)){
            const snappedY = this.snapValueToStep(currentY, this.itemHeight);
            console.log(`初始化轉輪${index+1}: 當前=${currentY}, 對齊後=${snappedY}`);
            reel.style.transform = `translate3d(0, ${snappedY}px, 0)`;
          } else {
            // 如果沒有變換，設置為初始位置
            reel.style.transform = `translate3d(0, 0px, 0)`;
          }
        });
      }

      getTranslateY(el){
        const style = getComputedStyle(el);
        const transform = style.transform;
        
        if(!transform || transform === 'none') return 0;
        
        // 解析transform矩陣
        const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
        if(matrix3d){
          const values = matrix3d[1].split(',').map(parseFloat);
          return values[13] || 0; // translateY in matrix3d
        }
        
        const matrix2d = transform.match(/matrix\(([^)]+)\)/);
        if(matrix2d){
          const values = matrix2d[1].split(',').map(parseFloat);
          return values[5] || 0; // translateY in matrix2d
        }
        
        // 解析translate3d
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

      showError(msg){ this.resultElement.innerHTML=`<span class="error">❌ 連線錯誤：${msg}</span>`; }

      animateResult(){
        this.resultElement.classList.add('success');
        setTimeout(()=>this.resultElement.classList.remove('success'),1200);
      }
    }

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
    });