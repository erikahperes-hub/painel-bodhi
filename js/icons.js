const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-6h4v6"/>',
  bars: '<path d="M4 20V10"/><path d="M10 20V6"/><path d="M16 20v-8"/><path d="M20 20V4"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.3 13.8c2.6.3 4.7 2.3 4.7 5.2"/>',
  send: '<path d="M3.5 11 20 4l-4.5 16-4.5-6.5z"/><path d="M11 13.5 20 4"/>',
  doc: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14 3.5v4h4"/><path d="M9 12.5h6M9 15.5h6M9 9.5h3"/>',
  wallet: '<rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10.5h17"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  logout: '<path d="M9 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3"/><path d="m15 8 4 4-4 4"/><path d="M19 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="m7 7 1 12h8l1-12"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5"/><path d="M12 16.4v.1"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3.5v4M16 3.5v4"/>',
  receipt: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>',
  printer: '<path d="M7 9V4.5h10V9"/><path d="M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><path d="M7 14h10v6H7z"/>',
  plug: '<path d="M9 7V4M15 7V4"/><path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V20"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  file: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14 3.5v4h4"/>',
  flow: '<circle cx="6" cy="5.5" r="2.4"/><circle cx="18" cy="18.5" r="2.4"/><path d="M8.4 5.5H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.6"/>',
};

export const ic = (nome, extra = '') => `<svg class="ic ${extra}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;

export const flor = (a = '#23BB84', b = '#E96A6A') =>
  `<svg class="flor" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="14" r="12" fill="${a}"/><circle cx="50" cy="32" r="12" fill="${b}"/><circle cx="32" cy="50" r="12" fill="${a}"/><circle cx="14" cy="32" r="12" fill="${b}"/><circle cx="32" cy="32" r="7" fill="#FFFCF6"/></svg>`;
