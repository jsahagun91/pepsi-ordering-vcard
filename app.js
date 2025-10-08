// PWA install prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Preload Pepsi logo as PNG base64 for vCard photo
let photoBase64 = '';
async function loadPhoto() {
  try {
    const res = await fetch('assets/Pepsi_2023.svg');
    if (!res.ok) return;
    const svgText = await res.text();
    // Convert SVG to PNG via canvas so contact apps display it reliably
    const svgBase64 = btoa(unescape(encodeURIComponent(svgText)));
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${svgBase64}`;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      if (img.complete && img.naturalWidth) resolve();
    });

    const canvasSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    const naturalWidth = img.naturalWidth || canvasSize;
    const naturalHeight = img.naturalHeight || canvasSize;
    const scale = Math.min(canvasSize / naturalWidth, canvasSize / naturalHeight);
    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;
    const dx = (canvasSize - drawWidth) / 2;
    const dy = (canvasSize - drawHeight) / 2;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
    photoBase64 = canvas.toDataURL('image/png').split(',')[1];
  } catch (err) {
    console.error('Failed to load Pepsi logo for vCard photo', err);
  }
  return photoBase64;
}
const photoReady = loadPhoto();

// Clone account block
const accountsContainer = document.getElementById('accounts');
document.getElementById('addAccount').addEventListener('click', () => {
  const first = accountsContainer.querySelector('.account');
  const clone = first.cloneNode(true);
  // Clear inputs
  clone.querySelectorAll('input').forEach(i => {
    if (i.type === 'checkbox') i.checked = false;
    else i.value = '';
  });
  accountsContainer.appendChild(clone);
  wireThirdPartyToggles();
});

// Hide/show ordering & delivery fields if 3rd party checked
function wireThirdPartyToggles() {
  document.querySelectorAll('.account').forEach(acc => {
    const toggle = acc.querySelector('.thirdPartyToggle');
    const conditional = acc.querySelector('.conditional');
    function update() {
      if (toggle.checked) {
        conditional.style.display = 'none';
      } else {
        conditional.style.display = 'grid';
      }
    }
    toggle.removeEventListener('change', update);
    toggle.addEventListener('change', update);
    update();
  });
}
wireThirdPartyToggles();

// Generate vCard
const form = document.getElementById('vcardForm');
const resultSection = document.getElementById('result');
const vcardPre = document.getElementById('vcardText');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const shareBtn = document.getElementById('shareBtn');

function buildVCard(data) {
  // vCard 3.0
  const lines = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push('N:Ordering;Pepsi;;;');
  lines.push('FN:Pepsi Ordering');
  lines.push('ORG:PepsiCo');
  lines.push('TITLE:Ordering & Equipment Support');
  if (photoBase64) {
    const prefix = 'PHOTO;ENCODING=b;TYPE=PNG:';
    const firstChunkLength = Math.max(0, 75 - prefix.length);
    const firstChunk = photoBase64.slice(0, firstChunkLength);
    lines.push(prefix + firstChunk);
    let offset = firstChunkLength;
    while (offset < photoBase64.length) {
      lines.push(' ' + photoBase64.slice(offset, offset + 75));
      offset += 75;
    }
  }
  lines.push('item1.TEL;TYPE=VOICE:1-800-963-2424'); // Ordering
  lines.push('item1.X-ABLabel:Ordering');
  lines.push('item2.TEL;TYPE=VOICE:1-800-555-4784'); // Repair
  lines.push('item2.X-ABLabel:Equipment Repair');
  lines.push('EMAIL;TYPE=Email Ordering:orders@pepsico.com');
  lines.push('URL;TYPE=Order Online:https://pepsicopartners.com');

  // Notes per account
  data.accounts.forEach((acc, idx) => {
    const nick = acc.nickname ? ` (${acc.nickname})` : '';
    const noteParts = [
      `Business: ${data.bizName}`,
      `Account: ${acc.account}`
    ];
    if (acc.orderNote) noteParts.push(`Note: ${acc.orderNote}`);
    if (!acc.thirdParty) {
      if (acc.orderingDay) noteParts.push(`Ordering: ${acc.orderingDay}`);
      if (acc.deliveryDay) noteParts.push(`Delivery: ${acc.deliveryDay}`);
    } else {
      noteParts.push('3rd-party ordering: yes');
    }
    lines.push('NOTE:' + noteParts.join(' \n '));
    if (idx < data.accounts.length - 1) lines.push('NOTE:——');
  });

  lines.push('CATEGORIES:Pepsi,Ordering,Support');
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function downloadVCard(vcf, filename = 'Pepsi-Ordering.vcf') {
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await photoReady;
  } catch (err) {
    console.warn('Continuing without contact photo', err);
  }
  const formData = new FormData(form);
  const bizName = formData.get('bizName');
  const accounts = [];
  const accEls = document.querySelectorAll('.account');
  accEls.forEach(acc => {
    accounts.push({
      account: acc.querySelector('input[name="account[]"]').value.trim(),
      nickname: acc.querySelector('input[name="nickname[]"]').value.trim(),
      orderNote: acc.querySelector('input[name="orderNote[]"]').value.trim(),
      orderingDay: acc.querySelector('input[name="orderingDay[]"]').value.trim(),
      deliveryDay: acc.querySelector('input[name="deliveryDay[]"]').value.trim(),
      thirdParty: acc.querySelector('.thirdPartyToggle').checked
    });
  });

  const vcf = buildVCard({ bizName, accounts });
  vcardPre.textContent = vcf;
  resultSection.hidden = false;
  if (shareBtn) shareBtn.hidden = !navigator.share;

  // Download handler
  downloadBtn.onclick = () => downloadVCard(vcf);
  downloadVCard(vcf);

  if (shareBtn && navigator.share) {
    shareBtn.onclick = async () => {
      try {
        const file = new File([vcf], 'Pepsi-Ordering.vcf', { type: 'text/vcard' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Pepsi Ordering Contact',
            text: 'Pepsi Ordering & Equipment Support'
          });
        } else {
          await navigator.share({
            title: 'Pepsi Ordering Contact',
            text: vcf
          });
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed', err);
          alert('Sharing failed. Try copying the text instead.');
        }
      }
    };
  }

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(vcf);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy text'), 1500);
    } catch { alert('Copy failed'); }
  };
});

document.getElementById('resetBtn').addEventListener('click', () => {
  // Remove extra accounts on reset
  const all = accountsContainer.querySelectorAll('.account');
  all.forEach((node, idx) => { if (idx > 0) node.remove(); });
  resultSection.hidden = true;
  if (shareBtn) shareBtn.hidden = true;
});
