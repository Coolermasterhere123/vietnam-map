// Extract lat/lng from Google Maps URL data= parameter
// URLs encode coords as !3d{lat}!4d{lng}
export function extractCoordsFromUrl(url) {
  if (!url) return null;
  const m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    // Sanity check: Vietnam bounding box (roughly)
    if (lat > 8 && lat < 24 && lng > 102 && lng < 110) {
      return { lat, lng };
    }
  }
  return null;
}

// Fallback curated coords for places whose URLs lack embedded coords
const knownCoords = {
  'Ben Thanh Market': { lat: 10.7725, lng: 106.6981 },
  'Jovia Hotel': { lat: 10.7797, lng: 106.6959 },
  'War Remnants Museum': { lat: 10.7796, lng: 106.6920 },
  'Notre Dame Cathedral of Saigon': { lat: 10.7798, lng: 106.6995 },
  'Independence Palace': { lat: 10.7769, lng: 106.6955 },
  'Saigon Central Post Office': { lat: 10.7798, lng: 106.7000 },
  'Bitexco Financial Tower': { lat: 10.7719, lng: 106.7047 },
  'Landmark 81': { lat: 10.7942, lng: 106.7219 },
  'Bui Vien Walking Street': { lat: 10.7685, lng: 106.6932 },
  'Ben Thanh Market': { lat: 10.7725, lng: 106.6981 },
  'Da Nang Cathedral': { lat: 16.0670, lng: 108.2210 },
  'Dragon Bridge': { lat: 16.0615, lng: 108.2265 },
  'My Khe Beach': { lat: 16.0480, lng: 108.2470 },
  'Lady Buddha': { lat: 16.0990, lng: 108.2700 },
  'The Marble Mountains': { lat: 15.9980, lng: 108.2590 },
  'Ba Na Hills': { lat: 15.9950, lng: 107.9950 },
  'Con Market': { lat: 16.0595, lng: 108.2140 },
  'Hoi An Market': { lat: 15.8770, lng: 108.3260 },
  'An Bang Beach': { lat: 15.9030, lng: 108.3340 },
  'My Son': { lat: 15.7630, lng: 108.1240 },
  'Mua cave': { lat: 20.2150, lng: 105.9350 },
  'Tràng An': { lat: 20.2540, lng: 105.9150 },
  'Bái Đính Pagoda': { lat: 20.2610, lng: 105.8430 },
  'Bich Dong Pagoda': { lat: 20.2200, lng: 105.9300 },
  'Hoa Lu Old town': { lat: 20.2530, lng: 105.9800 },
};

// City centers + hotel fallback GPS (used when user is outside Vietnam)
export const cityDefaults = {
  'Da Nang': {
    center: { lat: 16.0544, lng: 108.2022 },
    hotelName: 'Diamond Sea Hotel',
    hotel: { lat: 16.0631, lng: 108.2450 },
  },
  'Ho chi minh city': {
    center: { lat: 10.7797, lng: 106.6959 },
    hotelName: 'Jovia Hotel',
    hotel: { lat: 10.7797, lng: 106.6959 },
  },
  'Hoi An': {
    center: { lat: 15.8801, lng: 108.3380 },
    hotelName: 'Emerald Hoi An Riverside Resort',
    hotel: { lat: 15.8775, lng: 108.3310 },
  },
  'TAM COC NINH BINH': {
    center: { lat: 20.2500, lng: 105.9740 },
    hotelName: 'Hoang Minh Mountainside Villa',
    hotel: { lat: 20.2380, lng: 105.9540 },
  },
  'Hanoi': {
    center: { lat: 21.0285, lng: 105.8542 },
    hotelName: 'Hai Bay Hotel',
    hotel: { lat: 21.0307955, lng: 105.8484744 },
  },
};

// Vietnam bounding box check
export function isInVietnam(lat, lng) {
  return lat >= 8.4 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5;
}

function getCoordsForPlace(title, url, city) {
  // 1. Try to extract from URL (most accurate)
  const fromUrl = extractCoordsFromUrl(url);
  if (fromUrl) return fromUrl;

  // 2. Try known curated list
  const titleLower = title.toLowerCase();
  for (const [name, coords] of Object.entries(knownCoords)) {
    if (titleLower === name.toLowerCase() || titleLower.includes(name.toLowerCase())) {
      return coords;
    }
  }

  // 3. City center + deterministic offset
  const base = cityDefaults[city]?.center || { lat: 16.0, lng: 108.0 };
  const seed = [...title].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    lat: base.lat + ((seed * 7 + 13) % 100) / 20000 - 0.0025,
    lng: base.lng + ((seed * 11 + 17) % 100) / 20000 - 0.0025,
  };
}

function parseCSVLine(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let field = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      fields.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      else { fields.push(line.slice(i, end).trim()); i = end + 1; }
    }
  }
  return fields;
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (lines[i].toLowerCase().includes('title')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];
  const results = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = parseCSVLine(line);
    const title = (row[0] || '').trim();
    const note = (row[1] || '').trim();
    const url = (row[2] || '').trim();
    const tags = (row[3] || '').trim();
    const comment = (row[4] || '').trim();
    if (title) results.push({ title, note, url, tags, comment });
  }
  return results;
}

const categoryKeywords = {
  food: ['bánh','banh','pho','phở','bún','bun','com','cơm','restaurant','quán','quan','nhà hàng','eatery','kitchen','food','beef','seafood','sushi','pizza','burger','steak','buffet','bbq','nem','bep','bếp','cao lầu','noodle','roti','ice cream','kem'],
  coffee: ['coffee','cafe','cà phê','ca phe','matcha','tea','trà','brew','cocktail bar'],
  sight: ['museum','cathedral','palace','bridge','mountain','beach','pagoda','temple','church','monument','street','tower','landmark','park','cave','hills','buddha','art','old town','ruins','airport','world','theatre','puppet','literature','observation','stilt house','market'],
  hotel: ['hotel','resort','villa','hostel','lodge'],
};

function getCategory(title) {
  const t = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => t.includes(kw))) return cat;
  }
  return 'other';
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const csvFiles = {
  'Da Nang': `Title,Note,URL,Tags,Comment
68 COFFEE & TEA,,https://www.google.com/maps/place/68+COFFEE+%26+TEA/data=!4m2!3m1!1s0x314217001c0d52a5:0xb08551f1c1f5b871,,
Bánh mì Cô Na,,https://www.google.com/maps/place/B%C3%A1nh+m%C3%AC+C%C3%B4+Na/data=!4m2!3m1!1s0x31421705a986aef1:0x9a7468af20245fc9,,
343 Hải Phòng,,https://www.google.com/maps/place/343+H%E1%BA%A3i+Ph%C3%B2ng/data=!4m2!3m1!1s0x3142184c1b090953:0x6d5869e903b9d8bd,,
Bánh Xèo Bà Dưỡng,"Locals go for banh xeo. Grab will drop off in front of baby shop as they cannot get to restaurant as it is down an alley, follow signage, at end of alley.",https://www.google.com/maps/place/B%C3%A1nh+X%C3%A8o+B%C3%A0+D%C6%B0%E1%BB%A1ng/data=!4m10!1m3!11m2!2sMdDn!3e3!3m5!1s0x314219ca278828ad:0xe50ace1cbe8f6f9f!8m2!3d16.0600!4d108.2150,,
TIỆM BÁNH MÌ CÀ PHÊ (68 Hoàng kế viêm),,https://www.google.com/maps/place/TIEM+BANH/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3142176fac372031:0x932fff2105801e7a!8m2!3d16.0660!4d108.2095,,
Con Market,,https://www.google.com/maps/place/Con+Market/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314218358f50a1bb:0x4b451504a6ccd4df!8m2!3d16.0595!4d108.2140,,
Bravo Pizzeria,,https://www.google.com/maps/place/Bravo+Pizzeria/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421905b8c14157:0x4ad1cd175ce5a682!8m2!3d16.0640!4d108.2290,,
Da Nang Cathedral,,https://www.google.com/maps/place/Da+Nang+Cathedral/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3142198f38589aef:0x9409e1a4c30cbf79!8m2!3d16.0670!4d108.2210,,
TÂY HỒ QUÁN - Bún Chả Hà Nội,,https://www.google.com/maps/place/TAY+HO+QUAN/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421700717124db:0x3b174f5561933e66!8m2!3d16.0605!4d108.2170,,
Góc Ẩm Thực Hà Nội,Option for Pho,https://www.google.com/maps/place/GOC+AM+THUC/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314217d8efa0c0bf:0xe2744408c1a40791!8m2!3d16.0640!4d108.2190,,
Son Tra Night Market BBQ,,https://www.google.com/maps/place/Son+Tra+Night+Market/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421900552b0741:0xf97578faee373189!8m2!3d16.0690!4d108.2380,,
KYOTO Sushi & Teppanyaki Restaurant,,https://www.google.com/maps/place/KYOTO+Sushi/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3142175c0eacf1bf:0x70c2d3fa8152f86!8m2!3d16.0625!4d108.2175,,
MIRKO Coffee & Chill Beer,,https://www.google.com/maps/place/MIRKO+Coffee/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314219a2478d12f9:0x83041e56fd7241ac!8m2!3d16.0685!4d108.2340,,
Nhà hàng Madame Lân,,https://www.google.com/maps/place/Madame+Lan/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421831ce4d457b:0xc2f54574a65b6322!8m2!3d16.0620!4d108.2235,,
Minh Coffee,,https://www.google.com/maps/place/Minh+Coffee/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3142172ea33f66c5:0x94273d93befeb4b!8m2!3d16.0615!4d108.2105,,
Doc moc buffet,349k seafood buffet,https://www.google.com/maps/place/Doc+moc+buffet/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3142175e5a3ab1cd:0xa86d7dd7f962e581!8m2!3d16.0620!4d108.2175,,
The Marble Mountains,,https://www.google.com/maps/place/Marble+Mountains/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31420dd4e14b2edb:0xbc6e1faf738be4c5!8m2!3d15.9980!4d108.2590,,
Lady Buddha,,https://www.google.com/maps/place/Lady+Buddha/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314217e7720eb169:0x3c384dd1530dc3fb!8m2!3d16.0990!4d108.2700,,
Tonkin Bún Chả Hà Nội,,https://www.google.com/maps/place/Tonkin/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421951b23c59a3:0xa3926834ead6d271!8m2!3d16.0685!4d108.2290,,
Mộc quán,"Very popular seafood restaurant, usually a queue to get in",https://www.google.com/maps/place/Moc+quan/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314217721a8aafc7:0x1c948e37d3931fef!8m2!3d16.0580!4d108.2220,,
"Oh la la! Breakfast, Brunch, Lunch",For western food if wanting a break,https://www.google.com/maps/place/Oh+la+la/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421700194f6e6d:0xc7e3e51e9dc4213d!8m2!3d16.0610!4d108.2170,,
Ba Na Hills,,https://www.google.com/maps/place/Ba+Na+Hills/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3141f7b5026661c9:0x847bab3e51ad7ea2!8m2!3d15.9950!4d107.9950,,
Bếp Cuốn Đà Nẵng,Must try this place,https://www.google.com/maps/place/Bep+Cuon/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314217f4632748f9:0xdc14dcdba4c73425!8m2!3d16.0635!4d108.2210,,
Diamond Sea Hotel,,https://www.google.com/maps/place/Diamond+Sea+Hotel/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421783ecacb2cd:0x1b3ab65dcfd4ff59!8m2!3d16.0631!4d108.2450,,
Nam Danh Seafood,,https://www.google.com/maps/place/Nam+Danh+Seafood/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314217e3980e8991:0xe10070aa2c0a3e13!8m2!3d16.0645!4d108.2450,,
Đại Dương Quán,"Great seafood spot that locals frequent. Cook fresh lobster from tank. Sauce over yum.",https://www.google.com/maps/place/Dai+Duong+Quan/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421b0e752e0597:0x68e17d7e7c23e1a5!8m2!3d16.0920!4d108.2680,,
Đà Nẵng International Airport,,https://www.google.com/maps/place/Da+Nang+Airport/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314219bab9b63451:0xd7a9441e697a048c!8m2!3d16.0440!4d108.1990,,
Dragon Bridge,,https://www.google.com/maps/place/Dragon+Bridge/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421996588a512f:0x493b652aa06b12e!8m2!3d16.0615!4d108.2265,,
My Khe Beach,,https://www.google.com/maps/place/My+Khe+Beach/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x31421782f7fa0ee3:0xeafb8ba272ee55ac!8m2!3d16.0480!4d108.2470,,
Hải Sản Lão Đại Đà Nẵng,"Order seafood from live holding tanks.",https://www.google.com/maps/place/Hai+San+Lao+Dai/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314219d5305a5279:0x1e7b79f26dff1c9d!8m2!3d16.0785!4d108.2375,,
1066 Ng. Quyền,Good locals place for fresh pho,https://www.google.com/maps/place/1066+Nguyen+Quyen/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x314219d4fbed5373:0xacaa057ab238bd1!8m2!3d16.0795!4d108.2375,,`,

  'Ho chi minh city': `Title,Note,URL,Tags,Comment
Bánh Xèo 46A,"This is a must place. Saw a video. And wow, it looked absolutely amazing",https://maps.google.com/?q=10.7740,106.7005,,
Pho Tau Bay,,https://maps.google.com/?q=10.7697,106.6942,,
Eggyolk Coffee,2 peas suggest for egg coffee,https://maps.google.com/?q=10.7772,106.6948,,
Bánh Mì Huynh Hoa,,https://maps.google.com/?q=10.7735,106.6968,,
Bò Bít Tết Cô Út,"Have the bo bit tet. Fried steak and eggs plus.",https://maps.google.com/?q=10.7695,106.6928,,
Ducky's Smash Burger,,https://maps.google.com/?q=10.7680,106.6920,,
Tân Định Market,,https://maps.google.com/?q=10.7905,106.6922,,
Bánh Mì Hồng Hoa,,https://maps.google.com/?q=10.7720,106.6955,,
Pho Quynh,Get the Bo Kho (beef stew) 2 peas abroad Rec'd,https://maps.google.com/?q=10.7692,106.6915,,
Bò Né Bà Nũi,Must try sizzling beef,https://maps.google.com/?q=10.7740,106.6975,,
Ben Thanh Market,,https://maps.google.com/?q=10.7725,106.6981,,
Bui Vien Walking Street,,https://maps.google.com/?q=10.7685,106.6932,,
The Cafe Apartment,,https://maps.google.com/?q=10.7728,106.6972,,
War Remnants Museum,,https://maps.google.com/?q=10.7796,106.6920,,
Notre Dame Cathedral of Saigon,,https://maps.google.com/?q=10.7798,106.6995,,
Independence Palace,,https://maps.google.com/?q=10.7769,106.6955,,
Saigon Central Post Office,,https://maps.google.com/?q=10.7798,106.7000,,
Bitexco Financial Tower,,https://maps.google.com/?q=10.7719,106.7047,,
Landmark 81,,https://maps.google.com/?q=10.7942,106.7219,,
Jovia Hotel,,https://maps.google.com/?q=10.7797,106.6959,,
Ho Thi Ky Food Street,Yum,https://maps.google.com/?q=10.7660,106.6955,,
Bánh Khọt Vũng Tàu Khanh,"Mini deep fried pancakes with shrimp on top.",https://maps.google.com/?q=10.7625,106.6890,,
Méo Meo Cat Cafe,Cats and coffee not far from our hotel!!,https://maps.google.com/?q=10.7720,106.6960,,
"Cơm tấm Đề Thám","Must try com tam, simple and delicious looking",https://maps.google.com/?q=10.7715,106.6935,,
Pho Hung,"For great pho of course. Get large beef brisket pho",https://maps.google.com/?q=10.7750,106.6930,,
Bánh Canh Cua 87,"Crab noodles paired with dough fritters",https://maps.google.com/?q=10.7640,106.6850,,
Phở Hòa Pasteur,,https://maps.google.com/?q=10.7760,106.6940,,
Bánh Xèo Ngọc Sơn,,https://maps.google.com/?q=10.7610,106.6890,,
Bến Nghé Street Food,,https://maps.google.com/?q=10.7715,106.7030,,`,

  'Hoi An': `Title,Note,URL,Tags,Comment
Phi banh mi,,https://maps.google.com/?q=15.8780,108.3270,,
Co Thu BBQ Restaurant,Yum!! Must try that place,https://maps.google.com/?q=15.8790,108.3260,,
Bánh Mì Phượng,,https://maps.google.com/?q=15.8780,108.3245,,
Cơm Gà Phương Oanh,Great fried chicken and lemongrass rice,https://maps.google.com/?q=15.8820,108.3360,,
Seashell by Nu Eatery,"Pork buns looked great.",https://maps.google.com/?q=15.8760,108.3260,,
"Đông Ốp La - Fried Egg, Beef Stew, Bun for breakfast","Must go super early for breakfast.",https://maps.google.com/?q=15.8800,108.3300,,
Madam Khanh - The Banh Mi Queen,,https://maps.google.com/?q=15.8775,108.3250,,
Hoi An Market,,https://maps.google.com/?q=15.8770,108.3260,,
Chùa Cầu,,https://maps.google.com/?q=15.8774,108.3256,,
Emerald Hoi An Riverside Resort,,https://maps.google.com/?q=15.8775,108.3310,,
My Son,,https://maps.google.com/?q=15.7630,108.1240,,
An Bang Beach,,https://maps.google.com/?q=15.9030,108.3340,,
White Rose Restaurant,,https://maps.google.com/?q=15.8780,108.3250,,
Coconut boat rowing,,https://maps.google.com/?q=15.8730,108.3250,,
Cao lầu Không Gian Xanh,,https://maps.google.com/?q=15.8775,108.3260,,
Hoi An Lantern Boat Tour,,https://maps.google.com/?q=15.8830,108.3380,,`,

  'TAM COC NINH BINH': `Title,Note,URL,Tags,Comment
Hoa Lu Old town,,https://maps.google.com/?q=20.2530,105.9800,,
Hoang Minh Mountainside Villa,,https://maps.google.com/?q=20.2380,105.9540,,
Bich Dong Pagoda,,https://maps.google.com/?q=20.2200,105.9300,,
Mua cave,500 stairs to top!,https://maps.google.com/?q=20.2150,105.9350,,
Bái Đính Pagoda,,https://maps.google.com/?q=20.2610,105.8430,,
Tràng An,Boat tour,https://maps.google.com/?q=20.2540,105.9150,,`,

  'Hanoi': `Title,Note,URL,Tags,Comment
Bếp Việt,,https://www.google.com/maps/place/B%E1%BA%BFp+Vi%E1%BB%87t/@21.0337446,96.6266755,6z/data=!4m10!1m3!11m2!2sMdDnZnEtHHNzlCodUIAsgrSJo5_aTw!3e3!3m5!1s0x3135ab280b021f63:0xa86443810197341e!8m2!3d21.0304749!4d105.8505279!16s%2Fg%2F11jszqnmhw,,
Bún chả 74 Hàng Quạt,,https://www.google.com/maps/place/B%C3%BAn+ch%E1%BA%A3+74/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab001163e089:0x413a37b83f2fc44b!8m2!3d21.0325441!4d105.8488354,,
Hanoi House Cocktail Bar - Cafe,,https://www.google.com/maps/place/Hanoi+House/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab95a07627c9:0x272917c39c1ef678!8m2!3d21.0291574!4d105.8494567,,
Sky Lotte Observation Deck,,https://www.google.com/maps/place/Sky+Lotte/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab6c92399987:0xa35f66ba8443e5b3!8m2!3d21.0321022!4d105.8126712,,
Street art,,https://www.google.com/maps/place/Street+art/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab0054bc41c7:0x3c2837dd18352fe3!8m2!3d21.0378193!4d105.8467353,,
Bánh cuốn Bà Xuân,,https://www.google.com/maps/place/Banh+cuon+Ba+Xuan/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abb9e407b5c5:0x25aeb4029c094866!8m2!3d21.0422194!4d105.8477356,,
Tầm vị,,https://www.google.com/maps/place/Tam+vi/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab69ebcf8dab:0x3bbee968f14bcc36!8m2!3d21.0290273!4d105.8394556,,
Hai Bay Hotel,,https://www.google.com/maps/place/Hai+Bay+Hotel/data=!4m13!1m3!11m2!2s!3e3!3m8!1s0x3135ab958a7565a5:0x8323f7186b145c2b!5m2!4m1!1i2!8m2!3d21.0307955!4d105.8484744,,
Temple Of Literature,,https://www.google.com/maps/place/Temple+Of+Literature/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab9926e7bd67:0x580e078874d5df1e!8m2!3d21.0281175!4d105.8356692,,
Cafe Giảng,,https://www.google.com/maps/place/Cafe+Giang/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abc0ee85335d:0xfca3408ac50e7363!8m2!3d21.0334664!4d105.854518,,
Banh Mi 25,,https://www.google.com/maps/place/Banh+Mi+25/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab74bb3716b5:0xebfbc0d84354deb3!8m2!3d21.036113!4d105.848577,,
Thang Long Water Puppet Theatre,,https://www.google.com/maps/place/Thang+Long+Water+Puppet/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abc013454289:0x4e5ea7a5d23aad1c!8m2!3d21.0316826!4d105.8533466,,
Hidden Gem Cafe Hanoi,,https://www.google.com/maps/place/Hidden+Gem+Cafe/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab22da9ec48d:0x8c6411cf507e6c76!8m2!3d21.0337446!4d105.8551911,,
Bun Cha Ta Hanoi,,https://www.google.com/maps/place/Bun+Cha+Ta/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abc0e966cf63:0x1c581d2e1774e31b!8m2!3d21.0343417!4d105.854475,,
Cafe Phố Cổ,,https://www.google.com/maps/place/Cafe+Pho+Co/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abbeed1a0639:0x1aa441a5b73b8bce!8m2!3d21.0322129!4d105.8510511,,
Tuyết Bún Chả 34,,https://www.google.com/maps/place/Tuyet+Bun+Cha/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab0009758acb:0x72167c19ee52eb9a!8m2!3d21.0413524!4d105.8472754,,
Max Coffee,,https://www.google.com/maps/place/Max+Coffee/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab001a406031:0x34ec2fe7d0a14bae!8m2!3d21.0336723!4d105.8507491,,
Đồng Xuân Market,,https://www.google.com/maps/place/Dong+Xuan+Market/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abb8e6c24487:0xd9def483e7f217e6!8m2!3d21.0381434!4d105.8500387,,
Coffee Nang,,https://www.google.com/maps/place/Coffee+Nang/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab0245bf4613:0x8eab9cb5ddc4c25b!8m2!3d21.0370225!4d105.8494822,,
Don Duck Old Quarter Restaurant,,https://www.google.com/maps/place/Don+Duck/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abbf3533e24f:0x9e172025ac4449c4!8m2!3d21.0337025!4d105.847198,,
Bami Bread,,https://www.google.com/maps/place/Bami+Bread/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abbf71886f8b:0x979784b19bfef3a!8m2!3d21.0341543!4d105.8514288,,
Ho Chi Minh's Stilt House,,https://www.google.com/maps/place/Ho+Chi+Minh+Stilt+House/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135aba6cb40909b:0x15d0fe7c07f55c3b!8m2!3d21.0381582!4d105.8331705,,
Pho 10 Ly Quoc Su,,https://www.google.com/maps/place/Pho+10+Ly+Quoc+Su/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab9588b10501:0xf8a3cc53d3aad1eb!8m2!3d21.0304962!4d105.8487892,,
King Roti Hàng Gai,,https://www.google.com/maps/place/King+Roti/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abbfbeaddc01:0xf7a228330bc9032!8m2!3d21.0324234!4d105.8505641,,
Bít Tết Ngọc Hiếu Cs 4 - Hàng Cót,,https://www.google.com/maps/place/Bit+Tet+Ngoc+Hieu/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab5e4d0cfd2f:0x30a2ba7512dba00e!8m2!3d21.0387639!4d105.8469591,,
Bún chả Hương Liên,,https://www.google.com/maps/place/Bun+cha+Huong+Lien/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abf2a4ba685d:0x7e67963f30fa90e7!8m2!3d21.0181373!4d105.8538926,,
Bánh Xèo Tôn Đức Thắng,,https://www.google.com/maps/place/Banh+Xeo+Ton+Duc+Thang/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab9eba65d431:0x9c1f71f6e0fc6aa4!8m2!3d21.0271013!4d105.8340351,,
Trang Tien Ice cream,,https://www.google.com/maps/place/Trang+Tien+Ice+cream/data=!4m13!1m3!11m2!2s!3e3!3m8!1s0x3135abeb7c5cbdad:0xedad730043bd6280!5m2!4m1!1i2!8m2!3d21.0248821!4d105.8547278,,
Phố Thìn,,https://www.google.com/maps/place/Pho+Thin/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abf981630aef:0xb8bddc1b76862cfc!8m2!3d21.018111!4d105.855301,,
Bún chả Hải Kiều,,https://www.google.com/maps/place/Bun+cha+Hai+Kieu/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab002ce093d7:0x872a82cd3757f3d9!8m2!3d21.0234057!4d105.8565877,,
Pizza 4P's Au Co,,https://www.google.com/maps/place/Pizza+4Ps/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab0036e1aee9:0x5d5a7ff0e3cb436!8m2!3d21.0592393!4d105.8338589,,
Bun Cha Dac Kim,,https://www.google.com/maps/place/Bun+Cha+Dac+Kim/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135abbe40899a17:0x9aa20a2ad5a0f0e4!8m2!3d21.0322493!4d105.8482095,,
Hanoi-Oi Kitchen,,https://www.google.com/maps/place/Hanoi-Oi+Kitchen/data=!4m10!1m3!11m2!2s!3e3!3m5!1s0x3135ab472600b59f:0x7703c1c1295b7f7a!8m2!3d21.0337202!4d105.8467059,,`,
};

export function buildPlaces() {
  const places = [];
  for (const [city, csv] of Object.entries(csvFiles)) {
    const rows = parseCSV(csv);
    for (const row of rows) {
      const coords = getCoordsForPlace(row.title, row.url, city);
      places.push({
        ...row,
        city,
        lat: coords.lat,
        lng: coords.lng,
        distance: Infinity,
        category: getCategory(row.title),
      });
    }
  }
  return places;
}
