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

// Preload Pepsi logo as data URI for vCard photo
let photoDataUri = '';
async function loadPhoto() {
  try {
    const res = await fetch('assets/Pepsi_2023.svg');
    if (!res.ok) return;
    const svgText = await res.text();
    // Encode SVG to base64 safely for inclusion in vCard
    const base64 = btoa(unescape(encodeURIComponent(svgText)));
    photoDataUri = `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error('Failed to load Pepsi logo for vCard photo', err);
  }
}
loadPhoto();

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

function buildVCard(data) {
  // vCard 3.0
  const lines = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push('N:Ordering;Pepsi;;;');
  lines.push('FN:Pepsi Ordering');
  lines.push('ORG:PepsiCo');
  lines.push('TITLE:Ordering & Equipment Support');
  if (photoDataUri) {
    lines.push(`PHOTO;VALUE=URI:${photoDataUri}`);
  }
  lines.push('item1.TEL;TYPE=VOICE:1-800-963-2424'); // Ordering
  lines.push('item1.X-ABLabel:Ordering');
  lines.push('item2.TEL;TYPE=VOICE:1-800-555-4784'); // Repair
  lines.push('item2.X-ABLabel:Equipment Repair');
  lines.push('EMAIL;TYPE=WORK:orders@pepsico.com');
  lines.push('URL;TYPE=WORK:https://pepsicopartners.com');

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

form.addEventListener('submit', (e) => {
  e.preventDefault();
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

  // Download handler
  downloadBtn.onclick = () => downloadVCard(vcf);
  downloadVCard(vcf);

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
});
