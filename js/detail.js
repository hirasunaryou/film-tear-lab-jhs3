'use strict';

(() => {
  const detailCanvas = document.getElementById('detailCanvas');
  if (!detailCanvas) return;

  const detailCtx = detailCanvas.getContext('2d');
  const DW = 900;
  const DH = 340;
  let detailScale = {x: 1, y: 1};
  let detailMode = 'energy';
  let detailDemoActive = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let detailDemoTime = 0;
  let lastDetailTime = performance.now();

  const detailUi = {
    replay: document.getElementById('detailReplay'),
    energy: document.getElementById('detailEnergy'),
    frame: document.getElementById('detailFrame'),
    caption: document.getElementById('detailCaption'),
    note: document.getElementById('detailNote')
  };

  function dClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dSmoothStep(value) {
    const t = dClamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function dRoundedRect(c, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + width - r, y);
    c.quadraticCurveTo(x + width, y, x + width, y + r);
    c.lineTo(x + width, y + height - r);
    c.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    c.lineTo(x + r, y + height);
    c.quadraticCurveTo(x, y + height, x, y + height - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function dArrow(c, x1, y1, x2, y2, color, width = 4, head = 13) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
    c.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
    c.closePath();
    c.fill();
  }

  function startDetailDemo() {
    detailDemoActive = true;
    detailDemoTime = 0;
  }

  function setDetailMode(next) {
    detailMode = next;
    detailUi.energy.classList.toggle('active', next === 'energy');
    detailUi.frame.classList.toggle('active', next === 'frame');
    detailUi.energy.setAttribute('aria-selected', String(next === 'energy'));
    detailUi.frame.setAttribute('aria-selected', String(next === 'frame'));
    startDetailDemo();
  }

  detailUi.energy.addEventListener('click', () => setDetailMode('energy'));
  detailUi.frame.addEventListener('click', () => setDetailMode('frame'));
  detailUi.replay.addEventListener('click', startDetailDemo);

  function detailDemoState() {
    if (detailMode === 'energy') {
      if (!detailDemoActive) {
        return {
          ratio: dClamp(energy / threshold(), 0, 1),
          snap: flash > 0 ? dClamp(flash / 0.18, 0, 1) : 0
        };
      }

      const t = dClamp(detailDemoTime / 4.8, 0, 1);
      if (t < 0.74) return {ratio: dSmoothStep(t / 0.74), snap: 0};
      if (t < 0.88) return {ratio: 1, snap: dSmoothStep((t - 0.74) / 0.14)};
      return {
        ratio: 0.08 * (1 - dSmoothStep((t - 0.88) / 0.12)),
        snap: 1 - dSmoothStep((t - 0.88) / 0.12)
      };
    }

    if (!detailDemoActive) {
      return {offset: dClamp((tip.y - CENTER) * 1.2, -72, 72)};
    }

    const t = dClamp(detailDemoTime / 5.2, 0, 1);
    let offset;
    if (t < 0.38) offset = -72 * dSmoothStep(t / 0.38);
    else if (t < 0.68) offset = -72;
    else offset = -72 * (1 - dSmoothStep((t - 0.68) / 0.32));
    return {offset};
  }

  function updateDetailCopy(text, note) {
    if (detailUi.caption.textContent !== text) detailUi.caption.textContent = text;
    if (detailUi.note.innerHTML !== note) detailUi.note.innerHTML = note;
  }

  function drawSpring(c, x, y1, y2, color, broken = 0) {
    const mid = (y1 + y2) / 2;
    const turns = 6;
    const amplitude = 8;
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    if (broken <= 0.05) {
      c.beginPath();
      c.moveTo(x, y1);
      for (let i = 1; i < turns * 2; i += 1) {
        const p = i / (turns * 2);
        c.lineTo(x + (i % 2 ? amplitude : -amplitude), y1 + (y2 - y1) * p);
      }
      c.lineTo(x, y2);
      c.stroke();
      return;
    }

    const gap = 10 + broken * 20;
    c.beginPath();
    c.moveTo(x, y1);
    for (let i = 1; i <= turns; i += 1) {
      const p = i / turns;
      c.lineTo(x + (i % 2 ? amplitude : -amplitude), y1 + (mid - gap - y1) * p);
    }
    c.stroke();

    c.beginPath();
    c.moveTo(x, y2);
    for (let i = 1; i <= turns; i += 1) {
      const p = i / turns;
      c.lineTo(x + (i % 2 ? -amplitude : amplitude), y2 - (y2 - mid - gap) * p);
    }
    c.stroke();
  }

  function drawDetailBackground() {
    const c = detailCtx;
    const background = c.createLinearGradient(0, 0, 0, DH);
    background.addColorStop(0, '#f8fbff');
    background.addColorStop(1, '#eaf1f8');
    c.fillStyle = background;
    c.fillRect(0, 0, DW, DH);

    c.strokeStyle = 'rgba(80,105,130,.10)';
    c.lineWidth = 1;
    for (let x = 30; x < DW; x += 36) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, DH);
      c.stroke();
    }
    for (let y = 25; y < DH; y += 36) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(DW, y);
      c.stroke();
    }
  }

  function drawEnergyDetail(state) {
    const c = detailCtx;
    const ratio = state.ratio;
    const snap = state.snap;
    const center = 184;
    const tipX = 616 + (snap > 0.55 ? 22 : 0);
    const openBack = 70 + ratio * 26;
    const processGap = 14 + ratio * 42;

    drawDetailBackground();

    c.fillStyle = '#556779';
    c.font = '700 16px sans-serif';
    c.fillText('裂け目の先端を大きくしたイメージ', 28, 29);

    c.save();
    c.shadowColor = 'rgba(31,52,76,.14)';
    c.shadowBlur = 12;
    c.shadowOffsetY = 4;
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#98a9bb';
    c.lineWidth = 2;

    c.beginPath();
    c.moveTo(35, 46);
    c.lineTo(865, 46);
    c.lineTo(865, center - 5);
    c.lineTo(tipX + 92, center - 5);
    c.quadraticCurveTo(tipX + 34, center - 5, tipX, center - processGap / 2);
    c.quadraticCurveTo(360, center - openBack * 0.78, 55, center - openBack);
    c.lineTo(35, center - openBack);
    c.closePath();
    c.fill();
    c.stroke();

    c.beginPath();
    c.moveTo(35, DH - 42);
    c.lineTo(865, DH - 42);
    c.lineTo(865, center + 5);
    c.lineTo(tipX + 92, center + 5);
    c.quadraticCurveTo(tipX + 34, center + 5, tipX, center + processGap / 2);
    c.quadraticCurveTo(360, center + openBack * 0.78, 55, center + openBack);
    c.lineTo(35, center + openBack);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    c.fillStyle = '#dce9ff';
    c.strokeStyle = '#2458d3';
    c.lineWidth = 3;
    dRoundedRect(c, 122, center - 29, 105, 58, 25);
    c.fill();
    c.stroke();
    c.fillStyle = '#173e9e';
    c.font = '800 16px sans-serif';
    c.fillText('指', 166, center + 6);
    dArrow(c, 176, center - 31, 176, center - openBack + 15, '#2458d3', 4, 12);
    dArrow(c, 176, center + 31, 176, center + openBack - 15, '#2458d3', 4, 12);
    c.fillStyle = '#173e9e';
    c.font = '700 14px sans-serif';
    c.fillText('裂け目を広げる', 104, center - openBack - 13);

    const glow = c.createRadialGradient(tipX, center, 4, tipX, center, 88);
    glow.addColorStop(0, `rgba(226,60,60,${0.35 + 0.48 * ratio})`);
    glow.addColorStop(0.35, `rgba(255,173,50,${0.18 + 0.38 * ratio})`);
    glow.addColorStop(1, 'rgba(255,173,50,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(tipX, center, 88, 0, Math.PI * 2);
    c.fill();

    const springColor = ratio < 0.55 ? '#36a06f' : ratio < 0.86 ? '#ef9e24' : '#e23c3c';
    drawSpring(c, tipX + 4, center - processGap / 2, center + processGap / 2, springColor, snap);
    c.fillStyle = '#6c4320';
    c.font = '800 14px sans-serif';
    c.fillText('材料のつながり', tipX - 28, center - processGap / 2 - 18);

    if (snap > 0.12) {
      c.strokeStyle = '#e23c3c';
      c.lineWidth = 3;
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        const innerRadius = 28 + snap * 8;
        const outerRadius = 43 + snap * 14;
        c.beginPath();
        c.moveTo(tipX + Math.cos(angle) * innerRadius, center + Math.sin(angle) * innerRadius);
        c.lineTo(tipX + Math.cos(angle) * outerRadius, center + Math.sin(angle) * outerRadius);
        c.stroke();
      }
      c.fillStyle = '#b42323';
      c.font = '900 25px sans-serif';
      c.fillText('パチッ！', tipX + 54, center + 10);
    }

    const meterX = 692;
    const meterY = 69;
    const meterWidth = 150;
    const meterHeight = 18;
    c.fillStyle = '#dce4ec';
    dRoundedRect(c, meterX, meterY, meterWidth, meterHeight, 9);
    c.fill();
    const meterGradient = c.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
    meterGradient.addColorStop(0, '#49a878');
    meterGradient.addColorStop(0.65, '#ffad32');
    meterGradient.addColorStop(1, '#e23c3c');
    c.fillStyle = meterGradient;
    dRoundedRect(c, meterX, meterY, meterWidth * ratio, meterHeight, 9);
    c.fill();
    c.strokeStyle = '#9e3030';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(meterX + meterWidth, meterY - 4);
    c.lineTo(meterX + meterWidth, meterY + meterHeight + 4);
    c.stroke();
    c.fillStyle = '#42556a';
    c.font = '700 13px sans-serif';
    c.fillText('先端周りの変形エネルギー', meterX - 8, meterY - 12);
    c.fillText('限界', meterX + meterWidth - 15, meterY + meterHeight + 19);

    c.fillStyle = '#24415f';
    c.font = '800 17px sans-serif';
    if (snap > 0.12) {
      c.fillText('つながりが切れ、破れの先端が少し進む', 305, 319);
      updateDetailCopy(
        'パチッ！　限界を超えると、材料のつながりが切れ、新しい先端が少し先にできます。',
        '<b>正確には：</b>エネルギーは消えるのではなく、新しい破断面をつくること、熱、音、フィルムの動きなどへ移ります。'
      );
    } else if (ratio > 0.82) {
      c.fillText('限界直前：先端の周りが強く引き伸ばされる', 275, 319);
      updateDetailCopy(
        '限界直前です。先端の周りのフィルムが強く伸び、材料のつながりが切れそうになっています。',
        '<b>正確には：</b>「赤い点にエネルギーがたまる」のではなく、赤い点の周囲の広がりをもつ領域に、伸びや曲げの変形エネルギーがたまります。'
      );
    } else {
      c.fillText('指が広げるほど、先端の周りの変形が大きくなる', 286, 319);
      updateDetailCopy(
        '指が裂け目を広げると、先端の周りのフィルムが少しずつ伸び、変形エネルギーが大きくなります。',
        '<b>正確には：</b>エネルギーが赤い点だけに貯金されるのではなく、赤い点の周りのフィルムが伸びたり曲がったりした状態として、変形エネルギーを持ちます。'
      );
    }
  }

  function drawFrameDetail(state) {
    const c = detailCtx;
    const center = 180;
    const offset = state.offset;
    const tipX = 500;
    const tipY = center + offset;
    const topY = 48;
    const bottomY = 292;
    const topFree = Math.max(38, tipY - topY);
    const bottomFree = Math.max(38, bottomY - tipY);
    const topWeight = bottomFree / (topFree + bottomFree);
    const bottomWeight = topFree / (topFree + bottomFree);

    drawDetailBackground();
    c.fillStyle = '#556779';
    c.font = '700 16px sans-serif';
    c.fillText('固定枠までの距離と、引く角度を比べるイメージ', 28, 29);

    c.fillStyle = '#68798a';
    dRoundedRect(c, 55, topY - 13, 790, 25, 8);
    c.fill();
    dRoundedRect(c, 55, bottomY - 12, 790, 25, 8);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = '800 14px sans-serif';
    c.fillText('固定枠', 72, topY + 5);
    c.fillText('固定枠', 72, bottomY + 5);

    c.fillStyle = 'rgba(255,255,255,.78)';
    c.strokeStyle = '#aebccc';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(85, topY + 13);
    c.lineTo(820, topY + 13);
    c.lineTo(820, bottomY - 12);
    c.lineTo(85, bottomY - 12);
    c.closePath();
    c.fill();
    c.stroke();

    c.strokeStyle = '#596b7d';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(95, center);
    c.lineTo(245, center);
    c.quadraticCurveTo(360, center, tipX, tipY);
    c.stroke();
    c.strokeStyle = '#f7f9fb';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(95, center);
    c.lineTo(245, center);
    c.quadraticCurveTo(360, center, tipX, tipY);
    c.stroke();

    c.fillStyle = '#dce9ff';
    c.strokeStyle = '#2458d3';
    c.lineWidth = 3;
    dRoundedRect(c, 220, center - 24, 86, 48, 22);
    c.fill();
    c.stroke();
    c.fillStyle = '#173e9e';
    c.font = '800 15px sans-serif';
    c.fillText('指', 253, center + 5);

    const topColor = topFree < bottomFree ? '#e8891c' : '#4b83d8';
    const bottomColor = bottomFree < topFree ? '#e8891c' : '#4b83d8';
    c.globalAlpha = 0.22;
    c.fillStyle = topColor;
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(720, topY + 13);
    c.lineTo(810, topY + 13);
    c.closePath();
    c.fill();
    c.fillStyle = bottomColor;
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(720, bottomY - 12);
    c.lineTo(810, bottomY - 12);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    dArrow(c, tipX + 8, tipY - 4, 720, topY + 18, topColor, 3 + 4 * topWeight, 12);
    dArrow(c, tipX + 8, tipY + 4, 720, bottomY - 17, bottomColor, 3 + 4 * bottomWeight, 12);

    c.setLineDash([6, 5]);
    c.lineWidth = 2;
    c.strokeStyle = topColor;
    c.beginPath();
    c.moveTo(456, topY + 15);
    c.lineTo(456, tipY - 7);
    c.stroke();
    c.strokeStyle = bottomColor;
    c.beginPath();
    c.moveTo(456, tipY + 7);
    c.lineTo(456, bottomY - 14);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = topColor;
    c.font = '800 14px sans-serif';
    c.fillText(`上の自由長 ${Math.round(topFree)}`, 325, (topY + tipY) / 2);
    c.fillStyle = bottomColor;
    c.fillText(`下の自由長 ${Math.round(bottomFree)}`, 325, (bottomY + tipY) / 2);

    const glow = c.createRadialGradient(tipX, tipY, 4, tipX, tipY, 62);
    glow.addColorStop(0, 'rgba(226,60,60,.76)');
    glow.addColorStop(1, 'rgba(255,173,50,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(tipX, tipY, 62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e23c3c';
    c.beginPath();
    c.arc(tipX, tipY, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8d2020';
    c.font = '800 14px sans-serif';
    c.fillText('破れの先端', tipX + 16, tipY - 13);

    const imbalance = Math.abs(topFree - bottomFree) / (topFree + bottomFree);
    if (imbalance > 0.08) {
      c.strokeStyle = '#16855b';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(tipX + 14, tipY, 48, -1.1, 1.1, offset > 0);
      c.stroke();
      c.fillStyle = '#126b4c';
      c.font = '800 15px sans-serif';
      c.fillText('力の角度と大きさが上下でそろわない', 555, 170);
      c.fillText('→ 次の一歩の向きが変わる', 585, 194);
      updateDetailCopy(
        '先端が片側へ寄ると、固定枠までの距離と引っ張る角度が上下で違い、先端の力のバランスが崩れます。',
        '<b>ここは表現を修正：</b>「反対側が必ず強くなる」と決めつけるより、上下の自由長・角度・摩擦が変わって、開く力と横ずれの力の割合が変わる、と考える方が正確です。'
      );
    } else {
      c.fillStyle = '#42556a';
      c.font = '800 16px sans-serif';
      c.fillText('中央付近では、上下の距離と角度がほぼ同じ', 510, 170);
      c.fillText('→ 力のバランスもほぼ対称', 555, 194);
      updateDetailCopy(
        '先端が中央付近にあると、固定枠までの距離と引っ張る角度が上下でほぼ同じです。',
        '<b>このモデルでは：</b>実物の複雑な枠・たわみ・摩擦の影響を、ひとまとめにして「中心へ戻す働き」として表しています。'
      );
    }

    c.fillStyle = '#24415f';
    c.font = '800 17px sans-serif';
    c.fillText('枠の大きさや位置が変わると、このバランスも変わる', 255, 326);
  }

  function drawDetail() {
    detailCtx.save();
    detailCtx.setTransform(detailScale.x, 0, 0, detailScale.y, 0, 0);
    detailCtx.clearRect(0, 0, DW, DH);
    const state = detailDemoState();
    if (detailMode === 'energy') drawEnergyDetail(state);
    else drawFrameDetail(state);
    detailCtx.restore();
  }

  function resizeDetailCanvas() {
    const rect = detailCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    detailCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    detailCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    detailScale = {x: detailCanvas.width / DW, y: detailCanvas.height / DH};
    drawDetail();
  }

  drawSideFeedback = function drawSideFeedbackWithFrameExplanation() {
    const offset = tip.y - CENTER;
    if (Math.abs(offset) < 12) return;
    const targetY = offset > 0 ? tip.y - 62 : tip.y + 62;
    arrow(tip.x + 3, tip.y, tip.x + 8, targetY, '#16855b', 3);
    ctx.fillStyle = '#126b4c';
    ctx.font = '700 13px sans-serif';
    ctx.fillText('中心へ戻す働き', tip.x + 20, targetY + (offset > 0 ? -3 : 15));
  };

  stateMessage = function stateMessageWithProcessZone() {
    const ratio = energy / threshold();
    const offset = tip.y - CENTER;
    if (finished) return 'フィルムの端まで破れました。条件を1つ変えて、波形を比べてみましょう。';
    if (flash > 0.02) return 'パチッ！　限界を超え、新しい「破れの先端」ができました。';
    if (ratio > 0.78) return 'もうすぐ限界です。先端の周りが強く伸び、変形エネルギーが大きくなっています。';
    if (Math.abs(offset) > 18) {
      return '先端が中央からずれ、固定枠までの距離と力の角度が上下で違ってきました。';
    }
    return mode === 'manual'
      ? '青い指を右へ動かすと、先端の周りのフィルムが伸び、変形エネルギーがたまります。'
      : '指が進み、先端の周りのフィルムに変形エネルギーがたまっています。';
  };

  function detailLoop(now) {
    const dt = Math.min(0.04, (now - lastDetailTime) / 1000);
    lastDetailTime = now;
    if (detailDemoActive) {
      detailDemoTime += dt;
      const limit = detailMode === 'energy' ? 4.8 : 5.2;
      if (detailDemoTime >= limit) {
        detailDemoActive = false;
        detailDemoTime = limit;
      }
    }
    drawDetail();
    requestAnimationFrame(detailLoop);
  }

  window.addEventListener('resize', resizeDetailCanvas);
  resizeDetailCanvas();
  requestAnimationFrame(detailLoop);
})();
