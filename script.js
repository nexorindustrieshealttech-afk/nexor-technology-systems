// --- FIREBASE CONFIGURATION & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, addDoc, query, where, orderBy, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, updateProfile, GoogleAuthProvider, OAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from './config.js'; // Importar configuración desde archivo externo

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- CONSTANTES Y UTILIDADES ---
const StorageService = {
    KEYS: {
        CART: 'nexor_cart',
        // USER y ORDERS se manejan ahora por Firebase, eliminados de LocalStorage para seguridad
    },
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            console.error("Error recuperando datos locales:", e);
            return null;
        }
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};

const formatPrice = (amount) => {
    const num = Number(amount);
    if (amount === undefined || amount === null || isNaN(num)) return '$0 COP';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
};
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    return (lastSpaceIndex > 0 ? truncated.substring(0, lastSpaceIndex) : truncated) + '...';
};
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const CONFIG = {
    CATALOG_TITLES: { 
        'hardware': 'Venta de Hardware', 
        'software': 'Desarrollo de Software', 
        'infrastructure': 'Infraestructura IT',
        'service': 'Servicios Profesionales',
        'all': 'Catálogo Completo' 
    },
    DEFAULT_CATALOG_TITLE: 'Catálogo Completo',
    PAYMENT_DELAY: 1500,
    NEQUI: {
        PHONE: "3053252358" // <--- CAMBIA ESTE NÚMERO POR EL TUYO PARA VINCULAR TU CUENTA
    }
};

// --- HELPER: DETECTAR PROVEEDOR ---
const getSupplierUI = (url) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.includes('amazon')) return { name: 'Amazon', icon: '📦', color: '#FF9900' }; // Naranja Amazon
    if (lower.includes('mercadolibre')) return { name: 'MercadoLibre', icon: '🤝', color: '#FFE600' }; // Amarillo ML
    return { name: 'Proveedor', icon: '🔗', color: 'var(--accent)' }; // Genérico
};

// --- BASE DE DATOS DE PRODUCTOS ---
let productsDb = {
    // --- BEST SELLERS AMAZON (HARDWARE) ---
    'logitech-g502': {
        title: "Logitech G502 HERO Gaming Mouse", price: 199900, originalPrice: 240000, tag: "HARDWARE // PERIPHERAL", sku: "AMZ-LOG-G502",
        desc: "El ratón gaming más popular del mundo. Sensor HERO 25K, 11 botones programables, peso ajustable y tecnología RGB LIGHTSYNC.",
        specs: { "DPI": "25,600", "BUTTONS": "11", "SENSOR": "HERO 25K", "WEIGHT": "Adjustable" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Logitech-G502-Performance-Gaming-Mouse/dp/B07GBZ4Q68",
        imgs: ["[ IMG_LOGITECH_G502 ]", "[ IMG_G502_SIDE ]", "[ IMG_G502_RGB ]", "[ IMG_G502_BOX ]"]
    },
    'razer-huntsman-v3': {
        title: "Razer Huntsman V3 Pro Analog", price: 1150000, tag: "HARDWARE // PERIPHERAL", sku: "AMZ-RAZER-HUNTSMAN",
        desc: "Teclado óptico analógico para esports. Switches Gen-2 con actuación ajustable, modo de disparo rápido y reposamuñecas magnético.",
        specs: { "SWITCH": "Analog Optical", "SIZE": "Full Size", "RGB": "Chroma", "ACTUATION": "Adjustable" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Razer-Huntsman-Analog-Gaming-Keyboard/dp/B0CCC6991P",
        imgs: ["[ IMG_HUNTSMAN_V3 ]", "[ IMG_KEYBOARD_RGB ]", "[ IMG_WRIST_REST ]", "[ IMG_RAZER_BOX ]"]
    },
    'logitech-mx-master-3s': {
        title: "Logitech MX Master 3S", price: 480000, tag: "HARDWARE // PERIPHERAL", sku: "AMZ-MX-MASTER3S",
        desc: "El ratón definitivo para productividad. Clics silenciosos, desplazamiento electromagnético MagSpeed y sensor de 8000 DPI que funciona sobre cristal.",
        specs: { "DPI": "8000", "BUTTONS": "7", "BATTERY": "70 Days", "CONN": "Bluetooth/Bolt" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Logitech-Master-Performance-Wireless-Mouse/dp/B09HM94VDS",
        imgs: ["[ IMG_MX_MASTER_3S ]", "[ IMG_MX_SIDE ]", "[ IMG_MX_TOP ]", "[ IMG_MX_DESK ]"]
    },
    'elgato-stream-deck': {
        title: "Elgato Stream Deck MK.2", price: 720000, tag: "HARDWARE // PERIPHERAL", sku: "AMZ-STREAM-DECK",
        desc: "Controlador de estudio con 15 teclas LCD personalizables. Dispara acciones en apps, lanza efectos de sonido y controla tu stream con un toque.",
        specs: { "KEYS": "15 LCD", "CONN": "USB-C", "OS": "Win/Mac", "CUSTOM": "Icons/Actions" },
        delivery: "Entrega: 4-7 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/Elgato-Stream-Deck-MK-2-Controller/dp/B09738CV2G",
        imgs: ["[ IMG_STREAM_DECK ]", "[ IMG_DECK_ICONS ]", "[ IMG_DECK_SIDE ]", "[ IMG_DECK_SETUP ]"]
    },
    'logitech-c920x': {
        title: "Logitech C920x HD Pro Webcam", price: 320000, tag: "HARDWARE // PERIPHERAL", sku: "AMZ-LOG-C920X",
        desc: "La webcam estándar de la industria. Video Full HD 1080p, corrección de luz automática y dos micrófonos estéreo para llamadas claras.",
        specs: { "RES": "1080p/30fps", "FOCUS": "Auto", "MIC": "Stereo Dual", "LENS": "Glass" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Logitech-C920x-Pro-HD-Webcam/dp/B085TFF7M1",
        imgs: ["[ IMG_C920X ]", "[ IMG_WEBCAM_LENS ]", "[ IMG_WEBCAM_MOUNT ]", "[ IMG_WEBCAM_BOX ]"]
    },
    'ryzen-7800x3d': {
        title: "AMD Ryzen 7 7800X3D 8-Core", price: 2100000, tag: "HARDWARE // PROCESSOR", sku: "AMZ-AMD-7800X3D",
        desc: "El mejor procesador para gaming del mercado actual. Tecnología AMD 3D V-Cache, 8 núcleos y 16 hilos para un rendimiento FPS máximo.",
        specs: { "CORES": "8", "THREADS": "16", "BOOST": "5.0 GHz", "CACHE": "104MB" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/AMD-Ryzen-7800X3D-16-Thread-Processor/dp/B0BTZB7F88",
        imgs: ["[ IMG_RYZEN_7800X3D ]", "[ IMG_CPU_BOX ]", "[ IMG_CPU_PIN ]", "[ IMG_CPU_INSTALLED ]"]
    },
    'intel-i9-14900k': {
        title: "Intel Core i9-14900K Desktop Processor", price: 2850000, tag: "HARDWARE // PROCESSOR", sku: "AMZ-INTEL-14900K",
        desc: "El procesador de escritorio más rápido del mundo. Hasta 6.0 GHz, 24 núcleos (8 P-cores + 16 E-cores) y 32 hilos para un rendimiento sin compromisos.",
        specs: { "CORES": "24 (8P+16E)", "THREADS": "32", "BOOST": "6.0 GHz", "SOCKET": "LGA 1700" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Intel-i9-14900K-Desktop-Processor-24-cores/dp/B0CGJDKLB8",
        imgs: ["[ IMG_I9_14900K ]", "[ IMG_CPU_TOP ]", "[ IMG_CPU_BOTTOM ]", "[ IMG_INTEL_BOX ]"]
    },
    'intel-i5-13600k': {
        title: "Intel Core i5-13600K Desktop Processor", price: 1450000, tag: "HARDWARE // PROCESSOR", sku: "AMZ-INTEL-13600K",
        desc: "El rey del rendimiento precio-calidad. 14 núcleos y 20 hilos, ideal para gaming y multitarea sin gastar una fortuna.",
        specs: { "CORES": "14 (6P+8E)", "THREADS": "20", "BOOST": "5.1 GHz", "SOCKET": "LGA 1700" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Intel-Core-i5-13600K-Desktop-Processor/dp/B0BCDR9M33",
        imgs: ["[ IMG_I5_13600K ]", "[ IMG_I5_CHIP ]", "[ IMG_I5_BOX ]", "[ IMG_I5_INSTALLED ]"]
    },
    'ryzen-9-7950x3d': {
        title: "AMD Ryzen 9 7950X3D", price: 3200000, tag: "HARDWARE // PROCESSOR", sku: "AMZ-RYZEN-7950X3D",
        desc: "Lo mejor de ambos mundos: Gaming y Productividad. 16 núcleos con tecnología 3D V-Cache para un rendimiento masivo en cualquier tarea.",
        specs: { "CORES": "16", "THREADS": "32", "BOOST": "5.7 GHz", "CACHE": "144MB" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/AMD-Ryzen-7950X3D-32-Thread-Processor/dp/B0BTRH9MNS",
        imgs: ["[ IMG_RYZEN_7950X3D ]", "[ IMG_AM5_SOCKET ]", "[ IMG_RYZEN_BOX ]", "[ IMG_RYZEN_LOGO ]"]
    },
    'ryzen-5-7600x': {
        title: "AMD Ryzen 5 7600X", price: 1100000, tag: "HARDWARE // PROCESSOR", sku: "AMZ-RYZEN-7600X",
        desc: "Entrada a la plataforma AM5. 6 núcleos de alto rendimiento optimizados para gaming puro. Requiere memoria DDR5.",
        specs: { "CORES": "6", "THREADS": "12", "BOOST": "5.3 GHz", "SOCKET": "AM5" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/AMD-7600X-12-Thread-Unlocked-Processor/dp/B0BBJDS62N",
        imgs: ["[ IMG_RYZEN_7600X ]", "[ IMG_7600X_CHIP ]", "[ IMG_7600X_BOX ]", "[ IMG_AM5_PIN ]"]
    },
    'samsung-990-pro': {
        title: "Samsung 990 PRO 2TB NVMe SSD", price: 950000, tag: "HARDWARE // STORAGE", sku: "AMZ-SAM-990PRO",
        desc: "Almacenamiento PCIe 4.0 ultrarrápido. Lectura hasta 7450 MB/s. Ideal para PS5 y PC Gaming de alto rendimiento.",
        specs: { "CAPACITY": "2TB", "READ": "7450 MB/s", "WRITE": "6900 MB/s", "INTERFACE": "PCIe 4.0" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'Out of Stock',
        supplierUrl: "https://www.amazon.com/SAMSUNG-Internal-Gaming-MZ-V9P2T0B-AM/dp/B0BHJJ9Y77",
        imgs: ["[ IMG_SAMSUNG_990 ]", "[ IMG_SSD_M2 ]", "[ IMG_SSD_BOX ]", "[ IMG_SSD_INSTALL ]"]
    },
    // --- STORAGE EXPANSION (NUEVOS) ---
    'wd-black-sn850x': {
        title: "WD_BLACK SN850X 1TB NVMe", price: 580000, tag: "HARDWARE // STORAGE", sku: "AMZ-WD-SN850X",
        desc: "Velocidad irracional para gaming. Hasta 7300 MB/s de lectura. Modo Juego 2.0 para tiempos de carga mínimos.",
        specs: { "CAPACITY": "1TB", "READ": "7300 MB/s", "INTERFACE": "PCIe Gen4", "TYPE": "M.2 NVMe" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/WD_BLACK-SN850X-Internal-Gaming-Solid/dp/B0B7CKVCCV",
        imgs: ["[ IMG_WD_SN850X ]", "[ IMG_WD_BOX ]", "[ IMG_WD_INSTALLED ]", "[ IMG_WD_HEAT ]"]
    },
    'crucial-mx500': {
        title: "Crucial MX500 1TB SATA SSD", price: 320000, tag: "HARDWARE // STORAGE", sku: "AMZ-CRUCIAL-MX500",
        desc: "El estándar en almacenamiento SATA. Fiabilidad probada, aceleración de escritura dinámica y cifrado de hardware AES de 256 bits.",
        specs: { "CAPACITY": "1TB", "READ": "560 MB/s", "INTERFACE": "SATA III", "FORM": "2.5 Inch" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Crucial-MX500-NAND-SATA-Internal/dp/B078211KBB",
        imgs: ["[ IMG_MX500 ]", "[ IMG_MX500_BOX ]", "[ IMG_MX500_BACK ]", "[ IMG_MX500_SIDE ]"]
    },
    'seagate-barracuda-4tb': {
        title: "Seagate BarraCuda 4TB HDD", price: 450000, tag: "HARDWARE // STORAGE", sku: "AMZ-SEA-BARRA",
        desc: "Almacenamiento masivo para archivos, backups y juegos. Tecnología Multi-Tier Caching para un rendimiento versátil.",
        specs: { "CAPACITY": "4TB", "RPM": "5400", "CACHE": "256MB", "SIZE": "3.5 Inch" },
        delivery: "Entrega: 4-6 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Seagate-BarraCuda-Internal-Drive-3-5-Inch/dp/B07D9C7SQH",
        imgs: ["[ IMG_BARRACUDA ]", "[ IMG_HDD_BACK ]", "[ IMG_HDD_SIDE ]", "[ IMG_HDD_LABEL ]"]
    },
    'samsung-t7-shield': {
        title: "Samsung T7 Shield 2TB Portable", price: 780000, tag: "HARDWARE // STORAGE", sku: "AMZ-SAM-T7",
        desc: "SSD externo resistente al agua, polvo y caídas (IP65). Transferencias ultrarrápidas USB 3.2 Gen 2 para creadores en movimiento.",
        specs: { "CAPACITY": "2TB", "SPEED": "1050 MB/s", "RATING": "IP65", "CONN": "USB-C" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/SAMSUNG-Shield-Portable-Photographers-MU-PE2T0S/dp/B09VLK9W3S",
        imgs: ["[ IMG_T7_SHIELD ]", "[ IMG_T7_BLUE ]", "[ IMG_T7_CABLE ]", "[ IMG_T7_WATER ]"]
    },
    'rtx-4070-super': {
        title: "ASUS Dual GeForce RTX 4070 Super", price: 3600000, tag: "HARDWARE // GRAPHICS_CARD", sku: "AMZ-RTX4070S",
        desc: "Potencia gráfica con arquitectura Ada Lovelace. 12GB GDDR6X, DLSS 3.5 y Ray Tracing completo para 1440p gaming.",
        specs: { "VRAM": "12GB", "CORES": "7168", "BOOST": "2505 MHz", "FANS": "Dual Axial" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/ASUS-DisplayPort-Axial-tech-Auto-Extreme-Technology/dp/B0CQPZK4X7",
        imgs: ["[ IMG_RTX_4070_SUPER ]", "[ IMG_GPU_SIDE ]", "[ IMG_GPU_PORTS ]", "[ IMG_GPU_BOX ]"]
    },
    'rtx-4090': {
        title: "MSI GeForce RTX 4090 Gaming X Trio", price: 9500000, tag: "HARDWARE // GRAPHICS_CARD", sku: "AMZ-RTX4090",
        desc: "La GPU definitiva. Rendimiento extremo para juegos en 8K y creación de contenido profesional. Arquitectura Ada Lovelace.",
        specs: { "VRAM": "24GB G6X", "CORES": "16384", "BOOST": "2595 MHz", "FANS": "Tri Frozr 3" },
        delivery: "Entrega: 10-15 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/MSI-GeForce-RTX-4090-24G/dp/B0BG95C83Z",
        imgs: ["[ IMG_RTX_4090 ]", "[ IMG_4090_SIDE ]", "[ IMG_4090_BACK ]", "[ IMG_4090_RGB ]"]
    },
    'rtx-4060': {
        title: "Gigabyte GeForce RTX 4060 Eagle OC", price: 1600000, tag: "HARDWARE // GRAPHICS_CARD", sku: "AMZ-RTX4060",
        desc: "La mejor opción para 1080p. DLSS 3, Ray Tracing y eficiencia energética superior. Diseño compacto de triple ventilador.",
        specs: { "VRAM": "8GB GDDR6", "CORES": "3072", "BOOST": "2505 MHz", "FANS": "Windforce 3X" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/GIGABYTE-GeForce-RTX-4060-Graphics/dp/B0C8K939C8",
        imgs: ["[ IMG_RTX_4060 ]", "[ IMG_4060_TOP ]", "[ IMG_4060_PORTS ]", "[ IMG_4060_BOX ]"]
    },
    'rx-7800-xt': {
        title: "Sapphire Pulse AMD Radeon RX 7800 XT", price: 2800000, tag: "HARDWARE // GRAPHICS_CARD", sku: "AMZ-RX7800XT",
        desc: "Potencia pura para 1440p. 16GB de VRAM para texturas ultra, arquitectura RDNA 3 y excelente relación precio-rendimiento.",
        specs: { "VRAM": "16GB GDDR6", "STREAM": "3840", "BOOST": "2430 MHz", "FANS": "Dual-X" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Sapphire-11330-02-20G-Radeon-Gaming-Graphics/dp/B0CFWRLDB5",
        imgs: ["[ IMG_RX_7800XT ]", "[ IMG_7800_SIDE ]", "[ IMG_7800_BACK ]", "[ IMG_7800_BOX ]"]
    },
    'rx-7900-xtx': {
        title: "XFX Speedster MERC310 RX 7900 XTX", price: 5200000, tag: "HARDWARE // GRAPHICS_CARD", sku: "AMZ-RX7900XTX",
        desc: "El buque insignia de AMD. 24GB de memoria, rendimiento 4K nativo y diseño térmico avanzado para entusiastas.",
        specs: { "VRAM": "24GB GDDR6", "STREAM": "6144", "BOOST": "2615 MHz", "FANS": "Triple Fan" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'Out of Stock',
        supplierUrl: "https://www.amazon.com/XFX-Speedster-MERC310-Graphics-RX-79XMERCB9/dp/B0BNLSZ23Q",
        imgs: ["[ IMG_RX_7900XTX ]", "[ IMG_7900_SIDE ]", "[ IMG_7900_PLATE ]", "[ IMG_7900_BOX ]"]
    },
    'corsair-vengeance': {
        title: "Corsair Vengeance DDR5 32GB (2x16)", price: 579900, originalPrice: 650000, tag: "HARDWARE // MEMORY_MODULE", sku: "AMZ-COR-DDR5",
        desc: "Memoria RAM DDR5 de 6000MHz optimizada para Intel y AMD. Disipador de aluminio de perfil bajo para máxima compatibilidad.",
        specs: { "CAPACITY": "32GB", "SPEED": "6000MHz", "CL": "30", "TYPE": "DDR5" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/CORSAIR-VENGEANCE-6000MHz-Compatible-Computer/dp/B0B771BL4S",
        imgs: ["[ IMG_CORSAIR_RAM ]", "[ IMG_DDR5_KIT ]", "[ IMG_RAM_SIDE ]", "[ IMG_RAM_BOX ]"]
    },
    'kingston-fury-beast': {
        title: "Kingston FURY Beast DDR4 16GB (2x8GB)", price: 220000, tag: "HARDWARE // MEMORY_MODULE", sku: "AMZ-KING-DDR4",
        desc: "Actualización de alto rendimiento y bajo costo. Disipador de calor de perfil bajo, compatible con Intel XMP y AMD Ryzen.",
        specs: { "CAPACITY": "16GB", "SPEED": "3200MHz", "CL": "16", "TYPE": "DDR4" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Kingston-FURY-3200MHz-KF432C16BBK2-16/dp/B097K2WBL3",
        imgs: ["[ IMG_KINGSTON_FURY ]", "[ IMG_FURY_STICK ]", "[ IMG_FURY_BOX ]", "[ IMG_FURY_INSTALLED ]"]
    },
    'gskill-trident-z5': {
        title: "G.SKILL Trident Z5 RGB DDR5 32GB", price: 780000, originalPrice: 850000, tag: "HARDWARE // MEMORY_MODULE", sku: "AMZ-GSKILL-Z5",
        desc: "Memoria DDR5 extrema diseñada para el rendimiento en plataformas de próxima generación. Barra de luz RGB aerodinámica.",
        specs: { "CAPACITY": "32GB", "SPEED": "6400MHz", "CL": "32", "TYPE": "DDR5" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/G-Skill-Trident-288-Pin-CL32-39-39-102-F5-6400J3239G16GX2-TZ5RK/dp/B09QS2K59B",
        imgs: ["[ IMG_TRIDENT_Z5 ]", "[ IMG_Z5_RGB ]", "[ IMG_Z5_SIDE ]", "[ IMG_Z5_BOX ]"]
    },
    'corsair-dominator-titanium': {
        title: "Corsair Dominator Titanium DDR5 64GB", price: 1450000, tag: "HARDWARE // MEMORY_MODULE", sku: "AMZ-COR-TITANIUM",
        desc: "Lujo y rendimiento combinados. Chips de memoria seleccionados a mano, refrigeración DHX patentada y barras superiores intercambiables.",
        specs: { "CAPACITY": "64GB", "SPEED": "6600MHz", "CL": "32", "TYPE": "DDR5" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/CORSAIR-DOMINATOR-TITANIUM-6000MHz-Memory/dp/B0CHSF5D84",
        imgs: ["[ IMG_DOMINATOR ]", "[ IMG_TITANIUM_RGB ]", "[ IMG_TITANIUM_TOP ]", "[ IMG_TITANIUM_BOX ]"]
    },
    'ps5-slim': {
        title: "PlayStation 5 Slim Console", price: 2550000, tag: "HARDWARE // CONSOLE", sku: "AMZ-PS5-SLIM",
        desc: "La consola de nueva generación de Sony en su versión más compacta. SSD ultrarrápido, Ray Tracing y gatillos adaptativos.",
        specs: { "STORAGE": "1TB SSD", "RES": "4K 120Hz", "HDR": "Yes", "DRIVE": "Disc Edition" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/PlayStation-5-Console-Slim/dp/B0CL61F39H",
        imgs: ["[ IMG_PS5_SLIM ]", "[ IMG_DUALSENSE ]", "[ IMG_PS5_PORTS ]", "[ IMG_PS5_BOX ]"]
    },
    // --- CONSOLES EXPANSION (NUEVOS) ---
    'xbox-series-x': {
        title: "Xbox Series X 1TB Console", price: 2450000, tag: "HARDWARE // CONSOLE", sku: "AMZ-XBOX-SX",
        desc: "La Xbox más rápida y potente de la historia. Juega miles de títulos de cuatro generaciones de consolas. 12 TFLOPS de potencia de procesamiento.",
        specs: { "STORAGE": "1TB NVMe", "RES": "4K 120Hz", "GPU": "12 TFLOPS", "DRIVE": "4K Blu-ray" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Xbox-X/dp/B08H75RTZ8",
        imgs: ["[ IMG_XBOX_SX ]", "[ IMG_XBOX_CTRL ]", "[ IMG_XBOX_TOP ]", "[ IMG_XBOX_BOX ]"]
    },
    'nintendo-switch-oled': {
        title: "Nintendo Switch OLED Model - White", price: 1390000, originalPrice: 1600000, tag: "HARDWARE // CONSOLE", sku: "AMZ-SWITCH-OLED",
        desc: "Pantalla OLED de 7 pulgadas con colores intensos y alto contraste. Soporte ancho ajustable, base con puerto LAN y audio mejorado.",
        specs: { "SCREEN": "7-inch OLED", "STORAGE": "64GB", "MODE": "TV/Tabletop/Handheld", "COLOR": "White Joy-Con" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Nintendo-Switch-OLED-Model-White-Joy/dp/B098RKWHHZ",
        imgs: ["[ IMG_SWITCH_OLED ]", "[ IMG_JOYCONS ]", "[ IMG_SWITCH_DOCK ]", "[ IMG_SWITCH_HAND ]"]
    },
    'rog-ally-z1': {
        title: "ASUS ROG Ally Z1 Extreme", price: 2950000, tag: "HARDWARE // CONSOLE", sku: "AMZ-ROG-ALLY",
        desc: "Potencia de PC gaming en tus manos. Procesador AMD Ryzen Z1 Extreme, pantalla 1080p 120Hz y Windows 11 Home.",
        specs: { "CPU": "Ryzen Z1 Extreme", "SCREEN": "7\" FHD 120Hz", "RAM": "16GB LPDDR5", "OS": "Windows 11" },
        delivery: "Entrega: 6-9 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/ASUS-ROG-Ally-Gaming-Handheld/dp/B0C4V8K747",
        imgs: ["[ IMG_ROG_ALLY ]", "[ IMG_ALLY_BACK ]", "[ IMG_ALLY_SCREEN ]", "[ IMG_ALLY_RGB ]"]
    },
    'steam-deck-oled': {
        title: "Valve Steam Deck OLED 512GB", price: 2750000, tag: "HARDWARE // CONSOLE", sku: "AMZ-STEAM-DECK",
        desc: "Tu biblioteca de Steam, en cualquier lugar. Pantalla OLED HDR, mayor duración de batería y descargas más rápidas con Wi-Fi 6E.",
        specs: { "SCREEN": "7.4\" OLED HDR", "REFRESH": "90Hz", "STORAGE": "512GB NVMe", "BATTERY": "50Whr" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'Out of Stock',
        supplierUrl: "https://www.amazon.com/Valve-Steam-Deck-OLED-512GB/dp/B0CPQYQ8L3",
        imgs: ["[ IMG_STEAM_DECK ]", "[ IMG_DECK_BACK ]", "[ IMG_DECK_UI ]", "[ IMG_DECK_CASE ]"]
    },
    'meta-quest-3': {
        title: "Meta Quest 3 128GB", price: 2800000, tag: "HARDWARE // VR_DEVICE", sku: "AMZ-QUEST-3",
        desc: "Realidad Mixta revolucionaria. Passthrough a color de alta fidelidad, procesador Snapdragon XR2 Gen 2 y lentes Pancake 4K+ Infinite Display.",
        specs: { "STORAGE": "128GB", "RES": "2064x2208", "REFRESH": "90/120Hz", "CPU": "XR2 Gen 2" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Meta-Quest-128GB-Breakthrough-Reality-Headset/dp/B0C8VKH1ZH",
        imgs: ["[ IMG_QUEST_3 ]", "[ IMG_VR_CONTROLLERS ]", "[ IMG_VR_LENSES ]", "[ IMG_VR_USER ]"]
    },
    'acer-nitro-v': {
        title: "Acer Nitro V 15 Gaming Laptop", price: 4200000, tag: "HARDWARE // LAPTOP", sku: "AMZ-ACER-NITRO",
        desc: "Portátil gaming calidad-precio. Intel Core i7-13620H, RTX 4050, 16GB RAM y pantalla de 144Hz para una experiencia fluida.",
        specs: { "CPU": "i7-13620H", "GPU": "RTX 4050", "RAM": "16GB", "SCREEN": "15.6 FHD 144Hz" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/Acer-i7-13620H-GeForce-Display-ANV15-51-73B9/dp/B0CRD4H3K6",
        imgs: ["[ IMG_ACER_NITRO ]", "[ IMG_LAPTOP_OPEN ]", "[ IMG_LAPTOP_PORTS ]", "[ IMG_LAPTOP_KEYBOARD ]"]
    },
    // --- LAPTOPS EXPANSION (NUEVOS) ---
    'macbook-air-m2': {
        title: "Apple MacBook Air 13.6\" M2 Chip", price: 4900000, originalPrice: 5500000, tag: "HARDWARE // LAPTOP", sku: "AMZ-MAC-AIR-M2",
        desc: "Diseño rediseñado increíblemente delgado. Chip M2 de Apple para un rendimiento y eficiencia energética sin precedentes. Pantalla Liquid Retina.",
        specs: { "CPU": "Apple M2 8-Core", "RAM": "8GB Unified", "SSD": "256GB", "SCREEN": "13.6\" Liquid Retina" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Apple-2022-MacBook-Laptop-chip/dp/B0B3C55J5P",
        imgs: ["[ IMG_MACBOOK_AIR ]", "[ IMG_MAC_SIDE ]", "[ IMG_MAC_KEYBOARD ]", "[ IMG_MAC_OPEN ]"]
    },
    'asus-tuf-a15': {
        title: "ASUS TUF Gaming A15", price: 3800000, tag: "HARDWARE // LAPTOP", sku: "AMZ-ASUS-TUF",
        desc: "Durabilidad de grado militar y rendimiento gaming. Procesador AMD Ryzen 7 y gráfica RTX 4050 para dominar cualquier juego.",
        specs: { "CPU": "Ryzen 7 7735HS", "GPU": "RTX 4050 6GB", "RAM": "16GB DDR5", "SCREEN": "15.6\" FHD 144Hz" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/ASUS-TUF-Gaming-A15-FA507NU-DS74/dp/B0C2V35L23",
        imgs: ["[ IMG_ASUS_TUF ]", "[ IMG_TUF_OPEN ]", "[ IMG_TUF_BACK ]", "[ IMG_TUF_PORTS ]"]
    },
    'hp-victus-15': {
        title: "HP Victus 15.6\" Gaming Laptop", price: 3100000, tag: "HARDWARE // LAPTOP", sku: "AMZ-HP-VICTUS",
        desc: "Todo lo que necesitas para jugar. Diseño térmico mejorado, procesador Intel Core i5 de 13ª gen y gráficos NVIDIA GeForce RTX.",
        specs: { "CPU": "i5-13420H", "GPU": "RTX 3050 6GB", "RAM": "8GB", "SCREEN": "15.6\" FHD 144Hz" },
        delivery: "Entrega: 4-7 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/HP-Victus-Gaming-Laptop-15-fa1093dx/dp/B0C6B3G77D",
        imgs: ["[ IMG_HP_VICTUS ]", "[ IMG_VICTUS_OPEN ]", "[ IMG_VICTUS_KEYBOARD ]", "[ IMG_VICTUS_SIDE ]"]
    },
    'dell-xps-13': {
        title: "Dell XPS 13 Plus", price: 6200000, tag: "HARDWARE // LAPTOP", sku: "AMZ-DELL-XPS",
        desc: "El equilibrio perfecto entre potencia y elegancia. Diseño minimalista con barra táctil capacitiva y pantalla InfinityEdge 3.5K OLED.",
        specs: { "CPU": "i7-1360P", "RAM": "16GB LPDDR5", "SSD": "512GB NVMe", "SCREEN": "13.4\" 3.5K OLED" },
        delivery: "Entrega: 7-12 días hábiles",
        stockStatus: 'Out of Stock',
        supplierUrl: "https://www.amazon.com/Dell-XPS-13-Plus-9320/dp/B0B4B5X5X5",
        imgs: ["[ IMG_DELL_XPS ]", "[ IMG_XPS_OPEN ]", "[ IMG_XPS_KEYBOARD ]", "[ IMG_XPS_THIN ]"]
    },
    // --- PREBUILT SYSTEMS (NUEVOS) ---
    'alienware-aurora-r16': {
        title: "Alienware Aurora R16 Gaming Desktop", price: 8500000, tag: "HARDWARE // PREBUILT_SYSTEM", sku: "AMZ-ALIEN-R16",
        desc: "Diseño Legend 3 optimizado para el flujo de aire. Potencia extrema con refrigeración líquida y chasis compacto sin herramientas.",
        specs: { "CPU": "Intel Core i7-14700F", "GPU": "RTX 4070 12GB", "RAM": "32GB DDR5", "STORAGE": "1TB NVMe SSD" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Alienware-Aurora-R16-Gaming-Desktop/dp/B0CBQJ1M5L",
        imgs: ["[ IMG_AURORA_R16 ]", "[ IMG_R16_RGB ]", "[ IMG_R16_INSIDE ]", "[ IMG_R16_PORTS ]"]
    },
    'hp-omen-45l': {
        title: "HP OMEN 45L Gaming Desktop", price: 11500000, tag: "HARDWARE // PREBUILT_SYSTEM", sku: "AMZ-HP-OMEN45L",
        desc: "La cámara criogénica patentada mantiene el procesador frío bajo cargas extremas. Rendimiento de nivel entusiasta para 4K gaming.",
        specs: { "CPU": "Intel Core i9-13900K", "GPU": "RTX 4080 16GB", "RAM": "64GB DDR5", "COOLING": "Cryo Chamber" },
        delivery: "Entrega: 10-15 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/HP-Desktop-GeForce-Windows-GT22-1090/dp/B0BV8Z2R46",
        imgs: ["[ IMG_OMEN_45L ]", "[ IMG_OMEN_CRYO ]", "[ IMG_OMEN_RGB ]", "[ IMG_OMEN_SIDE ]"]
    },
    'mac-studio-m2': {
        title: "Apple Mac Studio M2 Max", price: 9800000, tag: "HARDWARE // PREBUILT_SYSTEM", sku: "AMZ-MAC-STUDIO",
        desc: "Una potencia creativa compacta. Chip M2 Max para renderizado 3D, procesamiento de video y compilación de código a velocidades vertiginosas.",
        specs: { "CHIP": "M2 Max 12-Core", "GPU": "30-Core GPU", "RAM": "32GB Unified", "PORTS": "Thunderbolt 4" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Apple-Mac-Studio-M2-Max/dp/B0C75L1H8V",
        imgs: ["[ IMG_MAC_STUDIO ]", "[ IMG_STUDIO_BACK ]", "[ IMG_STUDIO_TOP ]", "[ IMG_STUDIO_PORTS ]"]
    },
    'skytech-azure-2': {
        title: "Skytech Azure 2 Gaming PC", price: 5500000, tag: "HARDWARE // PREBUILT_SYSTEM", sku: "AMZ-SKY-AZURE",
        desc: "El punto dulce del PC Gaming. Estética impresionante con vidrio templado y rendimiento sólido para 1440p en títulos modernos.",
        specs: { "CPU": "Intel Core i5-13600K", "GPU": "RTX 4060 Ti", "RAM": "16GB DDR5", "WIFI": "Wi-Fi 6" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Skytech-Azure-Gaming-PC-Desktop/dp/B0C9P3K8Q6",
        imgs: ["[ IMG_SKYTECH_PC ]", "[ IMG_PC_RGB ]", "[ IMG_PC_GLASS ]", "[ IMG_PC_INSIDE ]"]
    },
    'apple-airpods-pro': {
        title: "Apple AirPods Pro (2nd Gen)", price: 1100000, tag: "HARDWARE // AUDIO", sku: "AMZ-AIRPODS-PRO",
        desc: "Cancelación activa de ruido hasta 2 veces mayor. Audio espacial personalizado y estuche de carga MagSafe (USB-C).",
        specs: { "CHIP": "H2", "ANC": "Yes", "BATTERY": "6h (30h total)", "CONN": "Bluetooth 5.3" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Apple-Generation-Cancelling-Transparency-Personalized/dp/B0D1XD1ZV3",
        imgs: ["[ IMG_AIRPODS_PRO ]", "[ IMG_CASE_OPEN ]", "[ IMG_EARBUD_DETAIL ]", "[ IMG_CASE_CLOSED ]"]
    },
    'monitor-lg-ultragear': {
        title: "LG UltraGear QHD 27-Inch", price: 1450000, tag: "HARDWARE // MONITOR", sku: "AMZ-LG-27GN800",
        desc: "Monitor Gaming IPS 144Hz 1ms. Compatible con NVIDIA G-SYNC y AMD FreeSync Premium. Resolución 2560x1440.",
        specs: { "SIZE": "27 Inch", "RES": "1440p (QHD)", "REFRESH": "144Hz", "PANEL": "IPS" },
        delivery: "Entrega: 7-10 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/LG-27GN800-B-Ultragear-Response-Compatible/dp/B08LLD2QXJ",
        imgs: ["[ IMG_LG_MONITOR ]", "[ IMG_MONITOR_BACK ]", "[ IMG_MONITOR_PORTS ]", "[ IMG_MONITOR_SIDE ]"]
    },
    'samsung-odyssey-g9': {
        title: "Samsung Odyssey OLED G9 49\"", price: 6500000, tag: "HARDWARE // MONITOR", sku: "AMZ-SAM-G9",
        desc: "El monitor gaming definitivo. Pantalla curva super ultra ancha de 49 pulgadas con tecnología OLED, tiempo de respuesta de 0.03ms y 240Hz.",
        specs: { "SIZE": "49\" DQHD", "PANEL": "OLED", "REFRESH": "240Hz", "CURVE": "1800R" },
        delivery: "Entrega: 10-15 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/SAMSUNG-Odyssey-G95SC-Monitor-LS49CG954SNXZA/dp/B0C48D7Q22",
        imgs: ["[ IMG_ODYSSEY_G9 ]", "[ IMG_G9_BACK ]", "[ IMG_G9_CURVE ]", "[ IMG_G9_RGB ]"]
    },
    'benq-tk700sti': {
        title: "BenQ TK700STi 4K Gaming Projector", price: 5800000, tag: "HARDWARE // PROJECTOR", sku: "AMZ-BENQ-PROJ",
        desc: "Proyector 4K HDR de tiro corto diseñado para gaming. Baja latencia de 16ms a 4K/60Hz, 3000 lúmenes de brillo y Android TV integrado.",
        specs: { "RES": "4K UHD", "BRIGHTNESS": "3000 Lumens", "LATENCY": "16ms", "SYSTEM": "Android TV" },
        delivery: "Entrega: 7-12 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/BenQ-TK700STi-Gaming-Projector-Keystone/dp/B08WYP2D3H",
        imgs: ["[ IMG_BENQ_PROJ ]", "[ IMG_PROJ_LENS ]", "[ IMG_PROJ_PORTS ]", "[ IMG_PROJ_REMOTE ]"]
    },
    'asus-proart-pa279cv': {
        title: "ASUS ProArt Display 27\" 4K", price: 2100000, tag: "HARDWARE // MONITOR", sku: "AMZ-ASUS-PROART",
        desc: "Monitor profesional para creadores de contenido. Calibrado de fábrica para precisión de color Delta E < 2, 100% sRGB y conectividad USB-C.",
        specs: { "SIZE": "27\" 4K", "COLOR": "100% sRGB", "ACCURACY": "Delta E < 2", "CONN": "USB-C 65W" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/ASUS-ProArt-Display-Monitor-PA279CV/dp/B08LCPY1TR",
        imgs: ["[ IMG_PROART ]", "[ IMG_PROART_SIDE ]", "[ IMG_PROART_PORTS ]", "[ IMG_PROART_STAND ]"]
    },
    // --- BEST SELLERS MERCADOLIBRE & AMAZON (NUEVOS) ---
    'xiaomi-redmi-note-13': {
        title: "Xiaomi Redmi Note 13 Pro 256GB", price: 1250000, originalPrice: 1500000, tag: "HARDWARE // SMARTPHONE", sku: "ML-XIA-NOTE13",
        desc: "El rey de la gama media. Cámara de 200MP, pantalla AMOLED 120Hz y carga turbo de 67W. El smartphone más buscado en MercadoLibre.",
        specs: { "STORAGE": "256GB", "RAM": "8GB", "CAMERA": "200MP", "BATTERY": "5000mAh" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://listado.mercadolibre.com.co/xiaomi-redmi-note-13-pro",
        imgs: ["[ IMG_REDMI_NOTE_13 ]", "[ IMG_REDMI_BACK ]", "[ IMG_REDMI_SCREEN ]", "[ IMG_REDMI_BOX ]"]
    },
    // --- SMARTPHONES EXPANSION (NUEVOS) ---
    'iphone-15-pro-max': {
        title: "Apple iPhone 15 Pro Max 256GB", price: 6200000, tag: "HARDWARE // SMARTPHONE", sku: "AMZ-IPHONE-15PM",
        desc: "Diseñado con titanio de grado aeroespacial. Chip A17 Pro, botón de acción personalizable y el sistema de cámaras más potente en un iPhone.",
        specs: { "STORAGE": "256GB", "CHIP": "A17 Pro", "CAMERA": "48MP Main", "SCREEN": "6.7\" Super Retina" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Apple-iPhone-Pro-Max-256GB/dp/B0CMZ7S976",
        imgs: ["[ IMG_IPHONE_15PM ]", "[ IMG_TITANIUM_SIDE ]", "[ IMG_ACTION_BTN ]", "[ IMG_IPHONE_BOX ]"]
    },
    'galaxy-s24-ultra': {
        title: "Samsung Galaxy S24 Ultra AI", price: 5800000, tag: "HARDWARE // SMARTPHONE", sku: "AMZ-S24-ULTRA",
        desc: "La era de la IA móvil ha llegado. Galaxy AI integrado, marco de titanio, S Pen incorporado y cámara de 200MP con zoom espacial.",
        specs: { "STORAGE": "512GB", "RAM": "12GB", "CAMERA": "200MP AI", "SCREEN": "6.8\" QHD+ 120Hz" },
        delivery: "Entrega: 4-6 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/SAMSUNG-Galaxy-Ultra-Unlocked-Smartphone/dp/B0CM4Q524V",
        imgs: ["[ IMG_S24_ULTRA ]", "[ IMG_S_PEN ]", "[ IMG_S24_BACK ]", "[ IMG_S24_AI ]"]
    },
    'pixel-8-pro': {
        title: "Google Pixel 8 Pro", price: 4100000, tag: "HARDWARE // SMARTPHONE", sku: "AMZ-PIXEL-8PRO",
        desc: "El teléfono Android por excelencia. Cámaras profesionales de Google, chip Tensor G3 y 7 años de actualizaciones de seguridad garantizadas.",
        specs: { "STORAGE": "128GB", "RAM": "12GB", "CAMERA": "50MP Pro", "SCREEN": "6.7\" Super Actua" },
        delivery: "Entrega: 6-9 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/Google-Pixel-Pro-Smartphone-Telephoto/dp/B0CGVQVX5C",
        imgs: ["[ IMG_PIXEL_8PRO ]", "[ IMG_PIXEL_BACK ]", "[ IMG_PIXEL_UI ]", "[ IMG_PIXEL_BOX ]"]
    },
    'motorola-edge-40-neo': {
        title: "Motorola Edge 40 Neo 5G", price: 1450000, tag: "HARDWARE // SMARTPHONE", sku: "ML-MOTO-EDGE40",
        desc: "Diseño curvo ultra delgado con protección IP68 contra agua. Pantalla pOLED de 144Hz y carga rápida TurboPower de 68W.",
        specs: { "STORAGE": "256GB", "RAM": "8GB", "SCREEN": "6.55\" pOLED", "BATTERY": "5000mAh" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://listado.mercadolibre.com.co/motorola-edge-40-neo",
        imgs: ["[ IMG_MOTO_EDGE ]", "[ IMG_MOTO_BACK ]", "[ IMG_MOTO_WATER ]", "[ IMG_MOTO_BOX ]"]
    },
    'fire-tv-stick-4k': {
        title: "Amazon Fire TV Stick 4K Max", price: 240000, originalPrice: 300000, tag: "HARDWARE // STREAMING", sku: "AMZ-FIRE-TV-4K",
        desc: "Convierte cualquier TV en Smart. Streaming en 4K Ultra HD, compatible con Dolby Vision, HDR10+ y audio inmersivo Dolby Atmos.",
        specs: { "RES": "4K UHD", "WIFI": "Wi-Fi 6", "REMOTE": "Alexa Voice", "STORAGE": "8GB" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/fire-tv-stick-4k-max-with-alexa-voice-remote/dp/B08MQZXN1X",
        imgs: ["[ IMG_FIRE_TV ]", "[ IMG_REMOTE ]", "[ IMG_TV_UI ]", "[ IMG_BOX_SIDE ]"]
    },
    'jbl-flip-6': {
        title: "JBL Flip 6 Portable Speaker", price: 480000, tag: "HARDWARE // AUDIO", sku: "AMZ-JBL-FLIP6",
        desc: "Sonido potente y cristalino. Resistente al agua y al polvo (IP67), hasta 12 horas de batería. El parlante bluetooth más vendido.",
        specs: { "POWER": "30W", "BATTERY": "12 Hours", "WATERPROOF": "IP67", "CONN": "Bluetooth 5.1" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/JBL-Flip-Portable-Bluetooth-Speaker/dp/B099TJGJ91",
        imgs: ["[ IMG_JBL_FLIP6 ]", "[ IMG_SPEAKER_SIDE ]", "[ IMG_WATER_RESIST ]", "[ IMG_JBL_BOX ]"]
    },
    'epson-ecotank-l3250': {
        title: "Impresora Epson EcoTank L3250", price: 890000, originalPrice: 1100000, tag: "HARDWARE // PRINTER", sku: "ML-EPSON-L3250",
        desc: "Multifuncional inalámbrica 3 en 1. Sistema de tanque de tinta de super alta capacidad y economía. Ideal para hogar y oficina.",
        specs: { "TYPE": "Ink Tank", "FUNC": "Print/Scan/Copy", "WIFI": "Direct", "YIELD": "4500 Pages (Bk)" },
        delivery: "Entrega: 3-6 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://listado.mercadolibre.com.co/impresora-epson-l3250",
        imgs: ["[ IMG_EPSON_L3250 ]", "[ IMG_INK_TANKS ]", "[ IMG_SCANNER ]", "[ IMG_PRINTER_DESK ]"]
    },
    'lenovo-ideapad-3': {
        title: "Lenovo IdeaPad Slim 3 15\"", price: 1850000, tag: "HARDWARE // LAPTOP", sku: "ML-LEN-IDEA3",
        desc: "Laptop ideal para estudiantes y oficina. Procesador Ryzen 5, diseño ligero y pantalla FHD antirreflejo.",
        specs: { "CPU": "Ryzen 5 7520U", "RAM": "8GB LPDDR5", "SSD": "512GB", "SCREEN": "15.6 FHD" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://listado.mercadolibre.com.co/portatil-lenovo-ideapad-3",
        imgs: ["[ IMG_LENOVO_SLIM ]", "[ IMG_KEYBOARD ]", "[ IMG_SIDE_PORTS ]", "[ IMG_LENOVO_CLOSED ]"]
    },
    // --- AUDIO EXPANSION (NUEVOS) ---
    'sony-wh1000xm5': {
        title: "Sony WH-1000XM5 Noise Canceling", price: 1600000, originalPrice: 1900000, tag: "HARDWARE // AUDIO", sku: "AMZ-SONY-XM5",
        desc: "Los mejores audífonos con cancelación de ruido del mercado. 30 horas de batería, llamadas cristalinas y diseño ultraligero.",
        specs: { "BATTERY": "30 Hours", "ANC": "Industry Leading", "CONN": "Bluetooth 5.2", "DRIVER": "30mm" },
        delivery: "Entrega: 4-6 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones-Hands-Free/dp/B09XS7JWHH",
        imgs: ["[ IMG_SONY_XM5 ]", "[ IMG_XM5_CASE ]", "[ IMG_XM5_SIDE ]", "[ IMG_XM5_WEARING ]"]
    },
    'galaxy-buds2-pro': {
        title: "Samsung Galaxy Buds2 Pro", price: 750000, originalPrice: 900000, tag: "HARDWARE // AUDIO", sku: "ML-SAM-BUDS2",
        desc: "Sonido Hi-Fi de 24 bits. Cancelación de ruido activa inteligente y ajuste ergonómico. Perfectos para el ecosistema Galaxy.",
        specs: { "AUDIO": "24-bit Hi-Fi", "ANC": "Intelligent", "BATTERY": "5h (18h case)", "WATER": "IPX7" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/SAMSUNG-Galaxy-Buds2-Pro-Bluetooth/dp/B0B2SFZ33P",
        imgs: ["[ IMG_GALAXY_BUDS ]", "[ IMG_BUDS_CASE ]", "[ IMG_BUDS_EAR ]", "[ IMG_BUDS_COLORS ]"]
    },
    'logitech-g733': {
        title: "Logitech G733 Lightspeed Wireless", price: 580000, tag: "HARDWARE // AUDIO", sku: "AMZ-LOG-G733",
        desc: "Auriculares gaming inalámbricos ultraligeros. Iluminación RGB frontal, audio Blue VO!CE y hasta 29 horas de batería.",
        specs: { "WEIGHT": "278g", "BATTERY": "29 Hours", "RGB": "Lightsync", "RANGE": "20m" },
        delivery: "Entrega: 3-6 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Logitech-G733-Wireless-Gaming-Headset/dp/B081415G6C",
        imgs: ["[ IMG_LOGI_G733 ]", "[ IMG_G733_RGB ]", "[ IMG_G733_MIC ]", "[ IMG_G733_SIDE ]"]
    },
    'bose-soundlink-flex': {
        title: "Bose SoundLink Flex Bluetooth", price: 650000, tag: "HARDWARE // AUDIO", sku: "AMZ-BOSE-FLEX",
        desc: "Altavoz portátil resistente al agua y polvo (IP67). Tecnología PositionIQ que ajusta el sonido según la orientación.",
        specs: { "BATTERY": "12 Hours", "WATERPROOF": "IP67", "MIC": "Built-in", "TYPE": "Portable" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Bose-SoundLink-Flex-Bluetooth-Speaker/dp/B099TJGJ91",
        imgs: ["[ IMG_BOSE_FLEX ]", "[ IMG_BOSE_FRONT ]", "[ IMG_BOSE_WATER ]", "[ IMG_BOSE_STRAP ]"]
    },
    // --- STREAMING, VR & MONITORS EXPANSION ---
    'roku-streaming-stick-4k': {
        title: "Roku Streaming Stick 4K", price: 220000, tag: "HARDWARE // STREAMING", sku: "AMZ-ROKU-4K",
        desc: "Streaming portátil y potente. Inicio superrápido, Wi-Fi de largo alcance y compatible con Dolby Vision y HDR10+.",
        specs: { "RES": "4K HDR", "WIFI": "Long-range", "REMOTE": "Voice Control", "OS": "Roku OS" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Roku-Streaming-Device-Vision-Controls/dp/B09BKCDXZC",
        imgs: ["[ IMG_ROKU_STICK ]", "[ IMG_ROKU_REMOTE ]", "[ IMG_ROKU_UI ]", "[ IMG_ROKU_BOX ]"]
    },
    'apple-tv-4k': {
        title: "Apple TV 4K Wi-Fi + Ethernet", price: 850000, tag: "HARDWARE // STREAMING", sku: "AMZ-APPLE-TV",
        desc: "La experiencia de Apple en la sala de tu casa. Chip A15 Bionic, HDR10+ y Dolby Vision. Funciona como hub para casa inteligente (Thread).",
        specs: { "STORAGE": "128GB", "CHIP": "A15 Bionic", "RES": "4K Dolby Vision", "CONN": "Wi-Fi 6 + Ethernet" },
        delivery: "Entrega: 3-5 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/2022-Apple-Wi-Fi-Storage-Generation/dp/B0BJ691D39",
        imgs: ["[ IMG_APPLE_TV ]", "[ IMG_SIRI_REMOTE ]", "[ IMG_TVOS_UI ]", "[ IMG_APPLE_BOX ]"]
    },
    'google-chromecast-4k': {
        title: "Chromecast with Google TV (4K)", price: 260000, tag: "HARDWARE // STREAMING", sku: "AMZ-CHROMECAST-4K",
        desc: "Todo tu entretenimiento en un solo lugar. Organiza películas y series de tus plataformas favoritas en una sola pantalla.",
        specs: { "RES": "4K HDR", "OS": "Google TV", "REMOTE": "Voice Remote", "COLOR": "Snow" },
        delivery: "Entrega: 2-4 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Google-Chromecast-Streaming-Entertainment-Snow/dp/B08KRV399H",
        imgs: ["[ IMG_CHROMECAST ]", "[ IMG_G_REMOTE ]", "[ IMG_GTV_UI ]", "[ IMG_G_BOX ]"]
    },
    'ps-vr2': {
        title: "PlayStation VR2 Headset", price: 3200000, tag: "HARDWARE // VR_DEVICE", sku: "AMZ-PSVR2",
        desc: "La próxima generación de juegos en realidad virtual. Pantallas OLED 4K HDR, seguimiento ocular y respuesta háptica en el casco.",
        specs: { "RES": "2000x2040 per eye", "PANEL": "OLED HDR", "REFRESH": "90/120Hz", "FOV": "110 Degrees" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/PlayStation-VR2-Headset/dp/B0CWJ55G3Z",
        imgs: ["[ IMG_PSVR2 ]", "[ IMG_SENSE_CTRL ]", "[ IMG_VR2_LENS ]", "[ IMG_VR2_BOX ]"]
    },
    'htc-vive-pro-2': {
        title: "HTC Vive Pro 2 Headset Only", price: 4500000, tag: "HARDWARE // VR_DEVICE", sku: "AMZ-VIVE-PRO2",
        desc: "Visualización 5K nítida y precisa. Resolución de 4896 x 2448, campo de visión de 120 grados y tasa de refresco de 120Hz.",
        specs: { "RES": "5K (4896x2448)", "REFRESH": "120Hz", "FOV": "120 Degrees", "AUDIO": "Hi-Res Certified" },
        delivery: "Entrega: 10-15 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/HTC-Vive-Pro-Headset-Only/dp/B094148K6D",
        imgs: ["[ IMG_VIVE_PRO2 ]", "[ IMG_VIVE_SIDE ]", "[ IMG_VIVE_LENS ]", "[ IMG_VIVE_BOX ]"]
    },
    'alienware-aw3423dwf': {
        title: "Alienware 34 Curved QD-OLED", price: 5200000, tag: "HARDWARE // MONITOR", sku: "AMZ-ALIEN-OLED",
        desc: "El primer monitor Gaming QD-OLED del mundo. Colores infinitos, negros perfectos y tiempo de respuesta de 0.1ms.",
        specs: { "SIZE": "34\" Ultrawide", "PANEL": "QD-OLED", "REFRESH": "165Hz", "RESP": "0.1ms" },
        delivery: "Entrega: 8-12 días hábiles",
        stockStatus: 'Low Stock',
        supplierUrl: "https://www.amazon.com/Alienware-AW3423DWF-Gaming-Monitor-Quantum/dp/B0BC48XJL4",
        imgs: ["[ IMG_ALIEN_OLED ]", "[ IMG_OLED_BACK ]", "[ IMG_OLED_CURVE ]", "[ IMG_OLED_PORTS ]"]
    },
    'benq-zowie-xl2566k': {
        title: "BenQ ZOWIE XL2566K 360Hz", price: 3100000, tag: "HARDWARE // MONITOR", sku: "AMZ-ZOWIE-360",
        desc: "El monitor oficial de los torneos de esports. Panel TN de 360Hz con tecnología DyAc+ para la máxima claridad de movimiento.",
        specs: { "SIZE": "24.5 Inch", "REFRESH": "360Hz", "PANEL": "TN Fast", "TECH": "DyAc+" },
        delivery: "Entrega: 5-8 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/BenQ-XL2566K-Gaming-Monitor-Adjustment/dp/B0BWS8Z4X6",
        imgs: ["[ IMG_ZOWIE_XL ]", "[ IMG_ZOWIE_SHIELD ]", "[ IMG_ZOWIE_BACK ]", "[ IMG_ZOWIE_STAND ]"]
    },
    'dell-ultrasharp-u2723qe': {
        title: "Dell UltraSharp 27 4K USB-C Hub", price: 2800000, tag: "HARDWARE // MONITOR", sku: "AMZ-DELL-U2723QE",
        desc: "El primer monitor de 27\" 4K con tecnología IPS Black. Contraste 2000:1, color preciso y hub de conectividad masivo.",
        specs: { "SIZE": "27\" 4K", "PANEL": "IPS Black", "CONTRAST": "2000:1", "HUB": "USB-C 90W" },
        delivery: "Entrega: 4-7 días hábiles",
        stockStatus: 'In Stock',
        supplierUrl: "https://www.amazon.com/Dell-UltraSharp-U2723QE-27-Monitor/dp/B09TQZP9CL",
        imgs: ["[ IMG_DELL_4K ]", "[ IMG_DELL_BACK ]", "[ IMG_DELL_PORTS ]", "[ IMG_DELL_SIDE ]"]
    },

    // --- SERVICIOS (MANTENIDOS) ---
    'support': {
        title: "Soporte 24/7 Premium", price: 800000, tag: "SERVICE // TECHNICAL_SUPPORT", sku: "NX-SVC-PREM-1Y",
        desc: "Suscripción anual de soporte prioritario. Acceso directo a ingenieros de nivel 3, reemplazo avanzado de hardware en 24 horas y consultoría mensual de optimización.",
        specs: { "RESPONSE": "< 15 Min", "COVERAGE": "Global 24/7", "CHANNEL": "Dedicated Line", "REPLACEMENT": "Express Overnight", "AGENTS": "AI + Human" },
        delivery: "Activación: Inmediata",
        imgs: ["[ IMG_SVC_DASH ]", "[ IMG_SVC_AGENT ]", "[ IMG_SVC_APP ]", "[ IMG_SVC_DOCS ]"]
    },
    'erp-suite': {
        title: "NEXOR ERP/CRM Suite", price: 20000000, tag: "SERVICE // SAAS_PLATFORM", sku: "NX-SVC-ERP-1Y",
        desc: "Solución integral para la gestión empresarial. Unifica ventas, inventario, contabilidad y relaciones con clientes en una única plataforma cloud, impulsada por IA para análisis predictivo.",
        specs: { "MODULES": "Ventas, RH, Contabilidad, Inventario", "PLATFORM": "Cloud-Based (SaaS)", "USERS": "10 Incluidos", "SUPPORT": "Basic Tier", "IMPLEMENTATION": "40 Horas" },
        delivery: "Implementación: 2-4 Semanas",
        imgs: ["[ IMG_ERP_DASH ]", "[ IMG_CRM_PIPELINE ]", "[ IMG_ERP_REPORTS ]", "[ IMG_ERP_SETTINGS ]"]
    },
    'cybersec-pack': {
        title: "CyberSec Sentinel Package", price: 10000000, tag: "SERVICE // SECURITY_AUDIT", sku: "NX-SVC-SEC-AUDIT",
        desc: "Auditoría de seguridad completa para su infraestructura digital. Incluye pentesting, análisis de vulnerabilidades y hardening de sistemas para proteger sus activos más críticos.",
        specs: { "SCOPE": "5 Servidores, 2 Web Apps", "DELIVERABLE": "Reporte de Vulnerabilidades", "HARDENING": "Nivel OS y Red", "CONSULTING": "10 Horas", "MONITORING": "1 Mes Incluido" },
        delivery: "Inicio: 48 Horas",
        imgs: ["[ IMG_CYBER_SCAN ]", "[ IMG_CYBER_REPORT ]", "[ IMG_CYBER_SOC ]", "[ IMG_CYBER_ALERT ]"]
    },
    'web-dev-service': {
        title: "Desarrollo Web a Medida", price: 36000000, tag: "SERVICE // CUSTOM_DEV", sku: "NX-SVC-WEB-DEV",
        desc: "Creación de plataformas web y aplicaciones complejas desde cero. Nuestro equipo de arquitectos de software diseña soluciones escalables, seguras y de alto rendimiento.",
        specs: { "STACK": "React/Vue, Node/Python, SQL/NoSQL", "INCLUYE": "Diseño UI/UX, Desarrollo, QA, Despliegue", "METODOLOGÍA": "Agile/Scrum", "DURACIÓN": "8-12 Semanas (Estimado)", "SOPORTE": "3 Meses Post-Lanzamiento" },
        delivery: "Fase 1: 2 Semanas",
        imgs: ["[ IMG_WEB_UI ]", "[ IMG_WEB_CODE ]", "[ IMG_WEB_ARCH ]", "[ IMG_WEB_DEVICES ]"]
    },
    'cloud-infra': {
        title: "Infraestructura Cloud Gestionada", price: 4000000, tag: "SERVICE // CLOUD_OPS", sku: "NX-SVC-CLOUD-MNG",
        desc: "Servicio mensual de gestión y optimización de su infraestructura en AWS, Azure o GCP. Nos encargamos del monitoreo, seguridad, backups y escalabilidad para que usted se enfoque en su negocio.",
        specs: { "PROVEEDORES": "AWS, Azure, Google Cloud", "SERVICIOS": "Monitoreo 24/7, SecOps, IaC, FinOps", "SLA": "99.95% Uptime", "TARIFA": "Mensual (por nodo)", "ONBOARDING": "Incluido" },
        delivery: "Activación: 24 Horas",
        imgs: ["[ IMG_CLOUD_DASH ]", "[ IMG_CLOUD_ARCH ]", "[ IMG_CLOUD_COST ]", "[ IMG_CLOUD_ALERT ]"]
    }
};

// --- CARGA DE DATOS EDITADOS (LOCALSTORAGE) ---
const savedProductsDb = StorageService.get('nexor_products_db');
if (savedProductsDb) {
    productsDb = { ...productsDb, ...savedProductsDb };
}

// --- LIMPIEZA DE PRECIOS ERRÓNEOS ---
// Eliminar productos con precios de 3 cifras o menos (ej: $320) que puedan venir de caché o errores
Object.keys(productsDb).forEach(key => {
    const p = productsDb[key];
    // Validación robusta: eliminar si es nulo, no tiene precio o precio es erróneo
    if (!p || typeof p !== 'object' || !p.price || p.price < 1000) {
        delete productsDb[key];
    }
});

// --- CORRECCIÓN DE CATEGORÍAS (MONITORES) ---
// Actualizar etiquetas antiguas 'OUTPUT_DEVICE' a 'MONITOR' o 'PROJECTOR'
Object.keys(productsDb).forEach(key => {
    if (productsDb[key] && productsDb[key].tag === 'HARDWARE // OUTPUT_DEVICE') {
        if (productsDb[key].title.toLowerCase().includes('projector') || productsDb[key].title.toLowerCase().includes('proyector')) {
            productsDb[key].tag = 'HARDWARE // PROJECTOR';
        } else {
            productsDb[key].tag = 'HARDWARE // MONITOR';
        }
    }
});

// --- VISTAS / TEMPLATES HTML ---
const View = {
    productCard(product, id) {
        if (!product) return ''; // Protección contra datos vacíos
        const shortDesc = truncateText(product.desc, 120);
        const isSoftware = product.tag && product.tag.toLowerCase().includes('service');
    
        let visual;
        if (isSoftware) {
            visual = `<div class="software-icon-placeholder">${product.title.split(' ')[0]}</div>`;
        } else if (product.imgs && product.imgs.length > 0) {
            const imgData = product.imgs[0];
            if (imgData.startsWith('data:') || imgData.startsWith('http')) {
                visual = `<img src="${imgData}" alt="${product.title}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                visual = imgData.replace('[ IMG_', '').replace(' ]', '');
            }
        } else {
            visual = 'N/A';
        }
    
        const specsHtml = Object.entries(product.specs).slice(0, 4).map(([key, value]) => `
            <div class="spec-item">
                <span class="spec-label">${key}</span>
                <span class="spec-value">${value}</span>
            </div>
        `).join('');
    
        const priceOrCta = View.priceDisplay(product, isSoftware);
        
        const stockStatus = product.stockStatus || 'In Stock';
        let stockColor = 'var(--success)';
        if (stockStatus === 'Low Stock') stockColor = '#ff9900';
        if (stockStatus === 'Out of Stock') stockColor = '#ff4444';

        const stockInfo = !isSoftware 
            ? `<div style="font-size:0.7rem; color:${stockColor}; margin-top:5px; font-weight:bold;">${stockStatus.replace(' ', ' ').toUpperCase()}</div>`
            : '';

        const isOutOfStock = stockStatus === 'Out of Stock';

        const buttonCta = isSoftware
            ? `<a href="contact.html?subject=Demo ${product.title}" class="btn-add">Solicitar Demo</a>`
            : `<button class="btn-add" data-id="${id}" data-title="${product.title}" data-price="${product.price}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'AGOTADO' : 'Añadir al Carrito'}</button>`;
    
        // Información de entrega
        const deliveryInfo = product.delivery 
            ? `<div style="font-size:0.7rem; color:var(--success); margin-top:5px; display:flex; align-items:center; gap:5px;">
                 <span>🚚</span> ${product.delivery}
               </div>` 
            : '';

        // Botón inteligente de proveedor (Detecta Amazon/ML)
        const supplierInfo = getSupplierUI(product.supplierUrl);
        const supplierBtn = supplierInfo 
            ? `<a href="${product.supplierUrl}" target="_blank" class="btn-supplier-link" style="border-color:${supplierInfo.color}; color:${supplierInfo.name === 'Proveedor' ? 'var(--accent)' : supplierInfo.color};">${supplierInfo.icon} VER EN ${supplierInfo.name.toUpperCase()}</a>` 
            : '';

        return `
            <div class="product-detail-card" data-category="${product.tag?.toLowerCase()}">
                <button class="btn-edit-product" data-id="${id}">✏️ EDITAR</button>
                <a href="product-detail.html?id=${id}" class="product-visual">
                    ${visual}
                </a>
                <div class="product-info">
                    <div class="product-header">
                        <span class="product-sku">SKU: ${product.sku}</span>
                        <a href="product-detail.html?id=${id}" style="text-decoration:none; color: inherit;">
                            <h3>${product.title}</h3>
                        </a>
                    </div>
                    <p class="product-short-desc">${shortDesc}</p>
                    <div class="specs-grid">${specsHtml}</div>
                    <div class="product-footer">
                        <div style="display:flex; flex-direction:column;">
                            ${priceOrCta}
                            ${deliveryInfo}
                            ${stockInfo}
                        </div>
                        ${buttonCta}
                    </div>
                    ${supplierBtn}
                </div>
            </div>
        `;
    },
    miniProductCard(product, id) {
        const rawImg = (product.imgs && product.imgs.length > 0) ? product.imgs[0] : '[ IMG_N/A ]';
        let imgContent;
        
        if (rawImg.startsWith('data:') || rawImg.startsWith('http')) {
            imgContent = `<img src="${rawImg}" alt="${product.title}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            imgContent = rawImg.replace('_FRONT', '').replace('[ IMG_', '').replace(' ]', '');
        }
        
        return `
            <a href="product-detail.html?id=${id}" class="mini-product-card">
                <div class="mini-prod-img">${imgContent}</div>
                <div class="mini-prod-info">
                    <h4 class="mini-prod-title">${product.title}</h4>
                    <div class="mini-prod-price">${formatPrice(product.price)}</div>
                </div>
            </a>
        `;
    },
    cartItem(item, index) {
        return `
            <div class="cart-item">
                <div>
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                </div>
                <button class="btn-remove-cart" data-index="${index}">Eliminar</button>
            </div>
        `;
    },
    checkoutItem(item) {
        return `
            <div class="checkout-summary-item">
                <span>${item.title}</span>
                <span>${formatPrice(item.price)}</span>
            </div>
        `;
    },
    orderCard(order) {
        const status = order.status || 'Procesando';
        const statusColor = status === 'Enviado' ? 'var(--success)' : 'var(--accent)';
        const shippingInfo = order.shipping ? `<div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:5px;">Enviado a: ${order.shipping.city}</div>` : '';
        return `
            <div class="order-card">
                <div class="order-header">
                    <span>ORDEN #${order.id}</span>
                    <span class="order-date">${order.date}</span>
                </div>
                <div class="order-body">
                    <div style="font-size:0.7rem; margin-bottom:5px; font-family:var(--font-code);">
                        ESTADO: <span style="color:${statusColor}; text-transform:uppercase;">${status}</span>
                    </div>
                    ${shippingInfo}
                    <div class="order-items">${order.items.map(i => `<div>- ${i.title}</div>`).join('')}</div>
                    <div class="order-total">TOTAL: ${formatPrice(order.total)}</div>
                </div>
            </div>
        `;
    },
    priceDisplay(product, isSoftware = false) {
        const hasSale = !isSoftware && product.originalPrice && product.originalPrice > product.price;

        if (isSoftware) {
            return `<div class="price-tag">Consultar</div>`;
        } else if (hasSale) {
            const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
            return `
                <div class="price-container">
                    <span class="original-price">${formatPrice(product.originalPrice)}</span>
                    <div class="sale-price-wrapper">
                        <span class="sale-price">${formatPrice(product.price)}</span>
                        <span class="discount-badge">-${discount}%</span>
                    </div>
                </div>
            `;
        } else {
            return `<div class="price-tag">${formatPrice(product.price)}</div>`;
        }
    }
};

// --- APLICACIÓN PRINCIPAL ---
const App = {
    state: {
        cart: [],
        adminOrders: [], // Cache local para pedidos de admin
        currentUser: null,
        adminListenerUnsubscribe: null, // Para detener la escucha al salir de admin
    },

    DOMElements: {},

    init() {
        // Carga segura del estado
        const savedCart = StorageService.get(StorageService.KEYS.CART);
        this.state.cart = Array.isArray(savedCart) ? savedCart : [];
        
        // --- LISTENER DE AUTENTICACIÓN REAL (FIREBASE) ---
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Usuario logueado
                this.state.currentUser = { name: user.displayName || user.email.split('@')[0], email: user.email, uid: user.uid };
            } else {
                // Usuario desconectado
                this.state.currentUser = null;
            }
            this.updateNavUser();
        });

        this.cacheDOMElements();
        // Inicialización robusta: si falla el canvas, la app sigue funcionando
        try { this.initNeuralCanvas(); } catch (e) { console.warn("Canvas error:", e); }
        this.initAdminUI();
        
        // Cargar productos de la nube en segundo plano
        this.fetchProductsFromDB();

        this.updateCartUI();
        this.updateNavUser();
        this.router();
        this.initEventListeners();
    },

    cacheDOMElements() {
        this.DOMElements = {
            productGrid: document.getElementById('product-grid'),
            cartSidebar: document.getElementById('cart-sidebar'),
            cartOverlay: document.getElementById('cart-overlay'),
            cartItems: document.getElementById('cart-items'),
            cartCount: document.getElementById('cart-count'),
            cartTotalPrice: document.getElementById('cart-total-price'),
            navUserSection: document.getElementById('nav-user-section'),
            authModal: document.getElementById('auth-modal'),
            checkoutItems: document.getElementById('checkout-items'),
            checkoutTotal: document.getElementById('checkout-total-display'),
            checkoutEmail: document.getElementById('checkout-email'),
            orderHistory: document.getElementById('order-history'),
            mainImage: document.getElementById('main-image'),
            paymentModal: document.getElementById('payment-modal'),
            paymentTitle: document.getElementById('payment-title'),
            paymentMsg: document.getElementById('payment-msg'),
            checkoutForm: document.getElementById('checkout-form'),
        };
    },

    router() {
        const path = window.location.pathname;

        if (path.includes('shop.html') || path.endsWith('/shop')) {
            this.initShopPage();
        } else if (path.includes('checkout.html')) {
            this.loadCheckoutPage();
        } else if (path.includes('dashboard.html')) {
            this.loadDashboard();
        } else if (path.includes('product-detail.html')) {
            this.loadProductDetail();
        } else {
            this.initHomePage();
        }
    },

    // --- LÓGICA DE LA APLICACIÓN ---

    saveCart() {
        StorageService.set(StorageService.KEYS.CART, this.state.cart);
        this.updateCartUI();
    },

    addToCart(id, title, price) {
        this.state.cart.push({ id, title, price });
        this.saveCart();
        this.toggleCart(); // Abrir carrito para confirmar
    },

    removeFromCart(index) {
        this.state.cart.splice(index, 1);
        this.saveCart();
    },

    async login(email, password) {
        if (!isValidEmail(email)) {
            this.showToast('Por favor ingrese un email válido.', 'error');
            return;
        }
        
        try {
            this.showToast('Iniciando sesión...', 'info');
            await signInWithEmailAndPassword(auth, email, password);
            this.toggleAuthModal();
            this.showToast(`Bienvenido de nuevo.`, 'success');
        } catch (error) {
            console.error("Login error:", error);
            let msg = 'Error al iniciar sesión.';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = 'Credenciales incorrectas.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Cuenta bloqueada temporalmente por seguridad. Intenta más tarde.';
            } else if (error.code === 'auth/configuration-not-found') {
                msg = '⚠️ Error Config: Habilita "Email/Password" en Firebase Console.';
            } else {
                msg = `Error Técnico: ${error.code}`; // Mostrar código real para saber qué falla
            }
            this.showToast(msg, 'error');
        }
    },

    async register(name, email, password) {
        if (!isValidEmail(email)) {
            this.showToast('Por favor ingrese un email válido.', 'error');
            return;
        }
        
        try {
            this.showToast('Creando cuenta...', 'info');
            await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(auth.currentUser, { displayName: name }); // Guardar nombre real para los correos
            await sendEmailVerification(auth.currentUser); // <--- ENVIAR CORREO DE VERIFICACIÓN
            this.toggleAuthModal();
            this.showToast(`Cuenta creada. Revisa tu correo para verificarla.`, 'success');
        } catch (error) {
            console.error("Register error:", error);
            let msg = 'Error al registrar.';
            if (error.code === 'auth/email-already-in-use') {
                msg = 'Este correo ya está registrado.';
            } else if (error.code === 'auth/weak-password') {
                msg = 'La contraseña es muy débil (mínimo 6 caracteres).';
            } else if (error.code === 'auth/operation-not-allowed') {
                msg = '⚠️ Error Config: Habilita "Email/Password" en Firebase Console -> Authentication.';
            } else if (error.message.includes('identity-toolkit-api')) {
                msg = '⚠️ Error API: La API de autenticación no está activada en Google Cloud.';
            } else {
                msg = `Error Técnico: ${error.code}`;
            }
            this.showToast(msg, 'error');
        }
    },

    async resetPassword(email) {
        if (!isValidEmail(email)) {
            this.showToast('Ingresa tu email en el campo de arriba primero.', 'info');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            this.showToast('📧 Correo de recuperación enviado. Revisa tu bandeja.', 'success');
        } catch (error) {
            console.error("Reset Password error:", error);
            this.showToast('Error al enviar correo. Verifica que el email esté bien escrito.', 'error');
        }
    },

    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            this.toggleAuthModal();
            this.showToast('¡Bienvenido! Acceso con Google exitoso.', 'success');
        } catch (error) {
            console.error("Google Auth Error:", error);
            let msg = 'Error al iniciar con Google.';
            if (error.code === 'auth/popup-closed-by-user') {
                msg = 'Cancelaste el inicio de sesión.';
            } else if (error.code === 'auth/unauthorized-domain') {
                msg = '⚠️ Dominio no autorizado: Agrega 127.0.0.1 en Firebase Console -> Auth -> Settings.';
            }
            this.showToast(msg, 'error');
        }
    },

    async loginWithMicrosoft() {
        try {
            const provider = new OAuthProvider('microsoft.com');
            await signInWithPopup(auth, provider);
            this.toggleAuthModal();
            this.showToast('¡Bienvenido! Acceso con Microsoft exitoso.', 'success');
        } catch (error) {
            console.error("Microsoft Auth Error:", error);
            this.showToast('Error al iniciar con Microsoft.', 'error');
        }
    },

    async logout() {
        await signOut(auth);
        window.location.href = 'index.html';
    },

    createOrderObject() {
        const orderEmail = this.state.currentUser?.email || this.DOMElements.checkoutEmail?.value || 'guest';
        const shippingData = {
            name: document.getElementById('checkout-name')?.value,
            phone: document.getElementById('checkout-phone')?.value,
            address: document.getElementById('checkout-address')?.value,
            city: document.getElementById('checkout-city')?.value,
            dept: document.getElementById('checkout-dept')?.value
        };
        return {
            id: 'NEX-' + Math.floor(Math.random() * 1000000),
            date: new Date().toISOString(), // Formato ISO para ordenar mejor
            displayDate: new Date().toLocaleDateString(),
            status: 'En Preparación',
            userEmail: orderEmail,
            userId: this.state.currentUser?.uid || 'guest',
            shipping: shippingData,
            total: this.state.cart.reduce((acc, item) => acc + item.price, 0),
            items: [...this.state.cart]
        };
    },

    async saveOrder(order) {
        // Guardar en Firestore (Nube)
        await addDoc(collection(db, "orders"), order);
        console.log("Orden guardada en la nube:", order.id);
    },

    createWhatsappMessage(order, paymentMethod) {
        const itemsList = order.items.map(i => `• ${i.title}`).join('\n');
        let paymentInfo;

        switch (paymentMethod) {
            case 'nequi':
                paymentInfo = '📎 *Adjunto mi comprobante de pago Nequi aquí.*';
                break;
            case 'card':
            case 'pse':
                paymentInfo = `✅ *Pago confirmado a través de la pasarela segura (${paymentMethod.toUpperCase()}).*`;
                break;
            default:
                paymentInfo = '✅ *Pago confirmado.*';
        }

        return `👋 Hola NEXOR, acabo de realizar el pedido *#${order.id}*.\n\n` +
               `👤 *Cliente:* ${order.shipping.name}\n` +
               `📍 *Ciudad:* ${order.shipping.city}\n` +
               `💰 *Total:* ${formatPrice(order.total)}\n\n` +
               `📦 *Productos:*\n${itemsList}\n\n` +
               `${paymentInfo}`;
    },

    async simulatePaymentProcess() {
        const activeMethod = document.querySelector('.payment-btn.active')?.dataset.method || 'card';
        this.DOMElements.paymentModal?.classList.add('active');
        
        this.DOMElements.paymentMsg.innerText = "Conectando con pasarela segura...";
        await delay(1000);
        
        if (activeMethod === 'card' || activeMethod === 'pse') {
            this.DOMElements.paymentMsg.innerText = "Serás redirigido a la pasarela de pagos segura (Wompi/Bold)...";
            await delay(2500);
            this.DOMElements.paymentTitle.innerText = "Verificando Pago...";
            this.DOMElements.paymentMsg.innerText = "Esperando confirmación de la transacción...";
            await delay(3000);
        } else if (activeMethod === 'nequi') {
            this.DOMElements.paymentMsg.innerText = "Enviando notificación Push a Nequi...";
            await delay(2000);
            this.DOMElements.paymentMsg.innerText = "Esperando confirmación en tu celular...";
            await delay(4000);
        }
        
        document.querySelector('.spinner').style.borderTopColor = 'var(--success)';
        this.DOMElements.paymentTitle.innerText = "¡Pago Exitoso!";
        this.DOMElements.paymentMsg.innerText = "Preparando confirmación...";
        this.DOMElements.paymentTitle.style.color = "var(--success)";
        
        const order = this.createOrderObject();
        
        try {
            await this.saveOrder(order); // Esperar a que se guarde en la nube
        } catch (e) {
            console.error("Error guardando orden:", e);
            this.showToast("Error de conexión, pero tu pedido se procesará vía WhatsApp.", "info");
        }

        this.state.cart = [];
        this.saveCart();

        const message = this.createWhatsappMessage(order, activeMethod);
        const phone = CONFIG.NEQUI.PHONE;
        window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(message)}`, '_blank');

        this.DOMElements.paymentMsg.innerText = "¡Gracias por tu compra! Redirigiendo...";
        await delay(2000);
        window.location.href = 'index.html';
    },

    // --- MANEJO DE UI Y VISTAS ---

    updateCartUI() {
        if (this.DOMElements.cartCount) {
            this.DOMElements.cartCount.innerText = this.state.cart.length;
        }
        
        if (this.DOMElements.cartItems) {
            if (this.state.cart.length === 0) {
                this.DOMElements.cartItems.innerHTML = '<p class="cart-empty">El carrito está vacío.</p>';
            } else {
                this.DOMElements.cartItems.innerHTML = this.state.cart.map((item, index) => View.cartItem(item, index)).join('');
            }
        }
        
        if (this.DOMElements.cartTotalPrice) {
            const total = this.state.cart.reduce((sum, item) => sum + item.price, 0);
            this.DOMElements.cartTotalPrice.innerText = formatPrice(total);
        }
    },

    updateNavUser() {
        const navUserDiv = this.DOMElements.navUserSection;
        if (!navUserDiv) return;

        if (this.state.currentUser) {
            navUserDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <a href="dashboard.html" class="nav-user-link">USER: ${this.state.currentUser.name.toUpperCase()}</a>
                    <button id="nav-logout-btn" class="nav-login-btn" style="color: #ff4444; border:none; background:none;">[ SALIR ]</button>
                </div>`;
        } else {
            navUserDiv.innerHTML = `<div class="nav-login-btn btn-open-auth">LOGIN / REGISTER</div>`;
        }

        // --- RECONOCIMIENTO AUTOMÁTICO DE ADMIN ---
        const lockBtn = document.querySelector('.admin-lock-btn');
        if (lockBtn && this.state.currentUser && this.state.currentUser.email === 'nexorindustrieshealttech@gmail.com') {
            lockBtn.style.opacity = '1';
            lockBtn.style.color = 'var(--accent)';
            lockBtn.style.textShadow = '0 0 15px var(--accent)';
            lockBtn.title = "👋 Hola Admin (Acceso Rápido)";
        }
    },

    toggleCart() {
        this.DOMElements.cartSidebar?.classList.toggle('active');
        this.DOMElements.cartOverlay?.classList.toggle('active');
    },

    toggleMobileMenu() {
        document.querySelector('.nav-menu')?.classList.toggle('active');
        document.querySelector('.mobile-menu-btn')?.classList.toggle('active');
    },

    toggleAuthModal() {
        this.DOMElements.authModal?.classList.toggle('active');
    },

    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}-form`)?.classList.add('active');
    },

    changeImage(element, content) {
        document.querySelectorAll('.thumb').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        const mainImg = this.DOMElements.mainImage;
        mainImg.style.opacity = '0';
        setTimeout(() => {
            if (content.startsWith('data:') || content.startsWith('http')) {
                mainImg.innerHTML = `<img src="${content}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            } else {
                mainImg.innerText = content;
            }
            mainImg.style.opacity = '1';
        }, 200);
    },

    switchPaymentMethod(method) {
        document.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.payment-btn[data-method="${method}"]`)?.classList.add('active');

        document.querySelectorAll('.payment-details').forEach(section => {
            section.classList.remove('active');
            section.querySelectorAll('input, select').forEach(el => el.disabled = true);
        });

        const activeSection = document.getElementById(`${method}-details`);
        if (activeSection) {
            activeSection.classList.add('active');
            activeSection.querySelectorAll('input, select').forEach(el => el.disabled = false);
        }
    },

    // --- ADMIN & EDITING LOGIC ---
    initAdminUI() {
        // Inyectar estilos CSS para modo admin (Persistencia y Botones)
        const adminStyle = document.createElement('style');
        adminStyle.innerHTML = `
            .btn-supplier-link { display: none; font-size: 0.7rem; margin-top: 5px; text-decoration: none; border: 1px solid; padding: 4px 8px; border-radius: 4px; transition: 0.3s; }
            body.admin-mode .btn-supplier-link { display: inline-block; }
            .btn-supplier-link:hover { filter: brightness(1.2); background: rgba(255,255,255,0.1); }
            .admin-logout-btn { display: none; position: fixed; bottom: 15px; right: 160px; z-index: 9999; background: #ff4444; color: #fff; border: none; padding: 8px; font-family: var(--font-code); font-size: 0.7rem; cursor: pointer; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
            body.admin-mode .admin-logout-btn { display: block; }
            
            /* Estilos para editar imagen al hacer click (Admin) */
            body.admin-mode .product-visual, body.admin-mode #main-image { cursor: pointer; position: relative; display: block; }
            body.admin-mode .product-visual::after, body.admin-mode #main-image::after {
                content: "📷 CAMBIAR IMAGEN"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: var(--accent); color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; pointer-events: none; opacity: 0; transition: 0.3s; box-shadow: 0 0 15px var(--accent-glow); z-index: 20; border: 1px solid #fff;
            }
            body.admin-mode .product-visual:hover::after, body.admin-mode #main-image:hover::after { opacity: 1; }
            body.admin-mode .product-visual:hover img, body.admin-mode #main-image:hover img { filter: brightness(0.4) blur(2px); transition: 0.3s; }
        `;
        document.head.appendChild(adminStyle);

        // 1. Inyectar el candadito en el Body (esquina inferior derecha)
        const lockBtn = document.createElement('div');
        lockBtn.className = 'admin-lock-btn';
        lockBtn.innerHTML = '🔒';
        lockBtn.title = "Modo Administrador";
        lockBtn.onclick = () => this.toggleAdminMode(lockBtn);
        document.body.appendChild(lockBtn);

        // 1.1 Botón de Gestión de Pedidos (Solo visible en modo admin)
        const ordersBtn = document.createElement('button');
        ordersBtn.className = 'admin-orders-btn';
        ordersBtn.innerHTML = '📦 GESTIONAR PEDIDOS';
        ordersBtn.onclick = () => this.openAdminOrdersModal();
        ordersBtn.style.cssText = "display:none; position:fixed; bottom:95px; right:15px; z-index:9998; background:var(--accent); color:#fff; border:none; padding:8px; font-family:var(--font-code); font-size:0.7rem; cursor:pointer; border-radius:4px; box-shadow: 0 0 10px rgba(0,0,0,0.5);";
        document.body.appendChild(ordersBtn);

        // 1.2 Botón de Reset (Solo visible en modo admin)
        const resetBtn = document.createElement('button');
        resetBtn.className = 'admin-reset-btn';
        resetBtn.innerHTML = '⚠️ RESET';
        resetBtn.onclick = () => this.adminHardReset();
        resetBtn.style.cssText = "display:none; position:fixed; bottom:135px; right:15px; z-index:9998; background:#ff4444; color:#fff; border:none; padding:8px; font-family:var(--font-code); font-size:0.7rem; cursor:pointer; border-radius:4px; box-shadow: 0 0 10px rgba(0,0,0,0.5);";
        document.body.appendChild(resetBtn);

        // 1.4 Botón de Cerrar Sesión Admin (Nuevo)
        const logoutAdminBtn = document.createElement('button');
        logoutAdminBtn.className = 'admin-logout-btn';
        logoutAdminBtn.innerHTML = 'CERRAR SESIÓN ADMIN';
        logoutAdminBtn.onclick = () => this.toggleAdminMode(lockBtn, true);
        document.body.appendChild(logoutAdminBtn);

        // 1.3 Botón de Limpieza de Precios (Solo visible en modo admin)
        const cleanBtn = document.createElement('button');
        cleanBtn.className = 'admin-clean-btn';
        cleanBtn.innerHTML = '🧹 LIMPIAR PRECIOS';
        cleanBtn.onclick = () => this.adminDeleteErroneousPrices();
        cleanBtn.style.cssText = "display:none; position:fixed; bottom:15px; right:60px; z-index:9998; background:#ff4444; color:#fff; border:none; padding:8px; font-family:var(--font-code); font-size:0.7rem; cursor:pointer; border-radius:4px; box-shadow: 0 0 10px rgba(0,0,0,0.5);";
        document.body.appendChild(cleanBtn);
            
        // 1.5 Botón de Subir Catálogo (Nuevo - Para sincronizar inicial)
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'admin-upload-btn';
        uploadBtn.innerHTML = '☁️ SUBIR CATÁLOGO';
        uploadBtn.onclick = () => this.adminUploadProducts();
        uploadBtn.style.cssText = "display:none; position:fixed; bottom:55px; right:15px; z-index:9998; background:#35469C; color:#fff; border:none; padding:8px; font-family:var(--font-code); font-size:0.7rem; cursor:pointer; border-radius:4px; box-shadow: 0 0 10px rgba(0,0,0,0.5);";
        document.body.appendChild(uploadBtn);

            // Botón oculto para migrar DB (Solo visible en consola o editando esto)
            // Se activará desde la consola con: App.adminUploadProducts()
            console.log("Admin System Ready. DB Connection: Active");

        // 2. Inyectar el Modal de Edición en el Body
        const modalHTML = `
        <div id="edit-modal" class="auth-overlay">
            <div class="auth-box" style="width: 500px; max-height: 90vh; overflow-y: auto;">
                <button class="auth-close">×</button>
                <h2 style="margin-bottom: 1rem; font-family: var(--font-title); color: var(--accent);">// EDITAR PRODUCTO</h2>
                <form id="edit-form" class="auth-form active" style="display:flex; flex-direction:column; gap:15px;">
                    <input type="hidden" id="edit-id">
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">TÍTULO</label>
                        <input type="text" id="edit-title" class="input-field">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px; border:1px dashed var(--accent);">
                        <div style="grid-column: span 2; font-size:0.7rem; color:var(--accent); margin-bottom:5px;">// CALCULADORA DE GANANCIA</div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-dim);">COSTO PROVEEDOR ($)</label>
                            <input type="number" id="edit-cost" class="input-field" placeholder="Costo Base">
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-dim);">MARGEN (%)</label>
                            <input type="number" id="edit-margin" class="input-field" placeholder="Ej: 30">
                        </div>
                        <button type="button" id="btn-calculate-price" style="grid-column: span 2; background:var(--accent); border:none; color:#fff; padding:8px; cursor:pointer; font-size:0.7rem; border-radius:2px; font-weight:bold;">CALCULAR PRECIO FINAL</button>
                    </div>
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">ESTADO DE STOCK</label>
                        <select id="edit-stock" class="input-field">
                            <option value="In Stock">En Stock</option>
                            <option value="Low Stock">Stock Bajo</option>
                            <option value="Out of Stock">Agotado</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">PRECIO DE VENTA (COP)</label>
                        <input type="number" id="edit-price" class="input-field">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">DESCRIPCIÓN</label>
                        <textarea id="edit-desc" class="input-field" rows="4"></textarea>
                    </div>
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">GALERÍA DE IMÁGENES</label>
                        <div id="edit-imgs-list" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; padding:10px; background:rgba(255,255,255,0.02); border-radius:4px; min-height:50px;"></div>
                        
                        <label style="font-size:0.7rem; color:var(--text-dim); margin-top:5px;">AGREGAR NUEVA (URL O SUBIR)</label>
                        <input type="text" id="edit-img" class="input-field" placeholder="Pegar URL nueva aquí...">
                        <input type="file" id="edit-img-file" class="input-field" accept="image/*" style="margin-top:5px;">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; color:var(--text-dim);">ENLACE PROVEEDOR (DROPSHIPPING)</label>
                        <input type="text" id="edit-supplier" class="input-field" placeholder="https://amazon.com/...">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="submit" class="btn-submit" style="flex:1;">GUARDAR</button>
                        <button type="button" id="btn-delete-product" class="btn-submit" style="background:transparent; border:1px solid #ff4444; color:#ff4444; flex:0.4;">ELIMINAR</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Modal de Pedidos Admin -->
        <div id="admin-orders-modal" class="auth-overlay">
            <div class="auth-box" style="width: 800px; max-height: 90vh; overflow-y: auto;">
                <button class="auth-close">×</button>
                <h2 style="margin-bottom: 1.5rem; font-family: var(--font-title); color: var(--accent);">// GESTIÓN DE PEDIDOS (DROPSHIPPING)</h2>
                <div id="admin-orders-list" style="display:flex; flex-direction:column; gap:20px;"></div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Listener para el formulario de edición
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProductChange();
        });

        // Listener para eliminar
        document.getElementById('btn-delete-product').addEventListener('click', () => {
            this.deleteProduct();
        });

        // Chequear persistencia de sesión admin al cargar
        if (localStorage.getItem('nexor_admin_mode') === 'true') {
            document.body.classList.add('admin-mode');
            lockBtn.innerHTML = '🔓';
            // Mostrar herramientas
            document.querySelector('.admin-orders-btn').style.display = 'block';
            document.querySelector('.admin-reset-btn').style.display = 'block';
            document.querySelector('.admin-clean-btn').style.display = 'block';
            this.initAdminRealtimeListener(); // Iniciar escucha en tiempo real
        }
    },

    toggleAdminMode(btn, forceLogout = false) {
        if (document.body.classList.contains('admin-mode') || forceLogout) {
            document.body.classList.remove('admin-mode');
            localStorage.removeItem('nexor_admin_mode'); // Eliminar persistencia
            if(btn) btn.innerHTML = '🔒';
            
            // Ocultar herramientas de admin
            this.stopAdminRealtimeListener(); // Detener escucha
            document.querySelector('.admin-orders-btn').style.display = 'none';
            document.querySelector('.admin-reset-btn').style.display = 'none';
            document.querySelector('.admin-clean-btn').style.display = 'none';
            document.querySelector('.admin-upload-btn').style.display = 'none';
            
            this.showToast('Modo Administrador desactivado.');
        } else {
            // Acceso Seguro: Verificación por Email de Firebase
            const adminEmail = 'nexorindustrieshealttech@gmail.com'; // Tu email de admin

            if (this.state.currentUser && this.state.currentUser.email === adminEmail) {
                document.body.classList.add('admin-mode');
                localStorage.setItem('nexor_admin_mode', 'true'); // Guardar persistencia
                btn.innerHTML = '🔓';
                
                // Mostrar herramientas de admin
                this.initAdminRealtimeListener(); // Iniciar escucha
                document.querySelector('.admin-orders-btn').style.display = 'block';
                document.querySelector('.admin-reset-btn').style.display = 'block';
                document.querySelector('.admin-clean-btn').style.display = 'block';
                document.querySelector('.admin-upload-btn').style.display = 'block';
                
                this.showToast('Modo Administrador ACTIVADO.', 'success');
            } else {
                this.showToast('⛔ Acceso denegado. Inicia sesión con la cuenta de administrador.', 'error');
                if (!this.state.currentUser) this.toggleAuthModal();
            }
        }
    },

    // --- NOTIFICACIONES EN TIEMPO REAL (ADMIN) ---
    initAdminRealtimeListener() {
        if (this.state.adminListenerUnsubscribe) return; // Ya está escuchando

        console.log("📡 Iniciando monitor de pedidos en tiempo real...");
        const q = query(collection(db, "orders"), orderBy("date", "desc"));
        
        let isFirstLoad = true;

        // onSnapshot se dispara cada vez que algo cambia en la base de datos
        this.state.adminListenerUnsubscribe = onSnapshot(q, (snapshot) => {
            if (isFirstLoad) {
                isFirstLoad = false;
                return; // Ignoramos la carga inicial para no notificar pedidos viejos
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const order = change.doc.data();
                    this.playNotificationSound();
                    this.showToast(`🔔 NUEVO PEDIDO: #${order.id} - ${formatPrice(order.total)}`, 'success');
                    
                    // Si el modal de pedidos está abierto, actualizarlo automáticamente
                    if (document.getElementById('admin-orders-modal').classList.contains('active')) {
                        this.openAdminOrdersModal();
                    }
                }
            });
        });
    },

    stopAdminRealtimeListener() {
        if (this.state.adminListenerUnsubscribe) {
            this.state.adminListenerUnsubscribe(); // Función de Firebase para dejar de escuchar
            this.state.adminListenerUnsubscribe = null;
            console.log("🔕 Monitor de pedidos detenido.");
        }
    },

    playNotificationSound() {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audio.volume = 0.6;
        audio.play().catch(e => console.warn("Sonido bloqueado por el navegador (interacción requerida):", e));
    },

    async updateOrderStatus(orderId, newStatus) {
        try {
            // Buscar el documento en Firestore por el ID de orden (campo 'id')
            const q = query(collection(db, "orders"), where("id", "==", orderId));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const docRef = querySnapshot.docs[0].ref;
                await updateDoc(docRef, { status: newStatus });
                this.showToast(`Orden actualizada: ${newStatus}`, 'success');
                this.openAdminOrdersModal(); // Refrescar la vista
            }
        } catch (e) {
            console.error("Error actualizando orden:", e);
            this.showToast("Error al actualizar estado.", "error");
        }
    },

    // --- DROPSHIPPING HELPER ---
    handleSupplierClick(orderId) {
        // Usar el cache de pedidos cargados en el modal
        const orders = this.state.adminOrders || [];
        const order = orders.find(o => o.id === orderId);
        
        if (order && order.shipping) {
            const s = order.shipping;
            // Copiar datos formateados al portapapeles
            const textToCopy = `${s.name}\n${s.address}\n${s.city}, ${s.dept}\nTel: ${s.phone}`;
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showToast('📋 Datos de envío copiados. ¡Listo para pegar en el proveedor!', 'success');
            }).catch(err => console.error('Error copiando:', err));
        }
    },

    async openAdminOrdersModal() {
        const container = document.getElementById('admin-orders-list');
        container.innerHTML = '<div class="spinner"></div><p style="text-align:center; color:var(--text-dim);">Cargando pedidos de la nube...</p>';
        document.getElementById('admin-orders-modal').classList.add('active');

        // Cargar pedidos desde Firestore
        const orders = [];
        try {
            const q = query(collection(db, "orders"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                orders.push(doc.data());
            });
            this.state.adminOrders = orders; // Guardar en cache para el helper
        } catch (e) {
            console.error("Error cargando pedidos:", e);
            container.innerHTML = '<p style="color:#ff4444; text-align:center;">Error al cargar pedidos. Revisa tu conexión.</p>';
            return;
        }

        if (orders.length === 0) {
            container.innerHTML = '<p style="color:var(--text-dim); text-align:center;">No hay pedidos registrados en el sistema.</p>';
        } else {
            container.innerHTML = orders.map(order => {
                let orderTotalCost = 0;
                let hasCostData = false;

                const itemsHtml = order.items.map(item => {
                    // Buscar URL del proveedor usando el ID guardado
                    const productInfo = productsDb[item.id];
                    
                    // Calcular costos si existen
                    if (productInfo && productInfo.cost) {
                        orderTotalCost += parseFloat(productInfo.cost);
                        hasCostData = true;
                    }

                    const supplierInfo = getSupplierUI(productInfo?.supplierUrl);
                    const supplierLink = productInfo && productInfo.supplierUrl 
                        ? `<a href="${productInfo.supplierUrl}" target="_blank" class="btn-admin-buy" data-order-id="${order.id}" style="color:${supplierInfo.color}; font-size:0.7rem; text-decoration:none; border:1px solid ${supplierInfo.color}; padding:2px 6px; border-radius:4px; margin-left:10px;">↗ COMPRAR EN ${supplierInfo.name.toUpperCase()}</a>`
                        : `<span style="color:var(--text-dim); font-size:0.7rem; margin-left:10px;">(Sin enlace proveedor)</span>`;

                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span>• ${item.title}</span>
                        ${supplierLink}
                    </div>`;
                }).join('');

                // Cálculo de ganancia
                const profit = order.total - orderTotalCost;
                const profitColor = profit >= 0 ? 'var(--success)' : '#ff4444';
                
                const profitSection = hasCostData 
                    ? `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; font-family:var(--font-code); font-size:0.8rem;">
                        <span style="color:var(--text-dim);">Venta: ${formatPrice(order.total)}</span>
                        <span style="color:var(--text-dim);">Costo: ${formatPrice(orderTotalCost)}</span>
                        <span style="color:${profitColor}; font-weight:bold; border:1px solid ${profitColor}; padding:2px 5px; border-radius:4px;">GANANCIA: ${formatPrice(profit)}</span>
                       </div>`
                    : `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); font-size:0.75rem; color:var(--text-dim); text-align:right;">
                        ⚠️ Configura el "Costo Proveedor" en los productos para calcular la ganancia.
                       </div>`;

                // Helper para botón de copiar
                const copyBtn = (text, label) => `
                    <button class="btn-copy" data-copy-text="${text}" data-copy-label="${label}"
                        style="background:rgba(255,255,255,0.1); border:none; color:var(--accent); cursor:pointer; padding:2px 6px; border-radius:3px; font-size:0.7rem; margin-left:5px;" title="Copiar al portapapeles">
                        📋
                    </button>`;

                const isCompleted = order.status === 'Completado';
                const statusColor = isCompleted ? 'var(--success)' : '#ff9900';
                const actionBtn = isCompleted 
                    ? `<span style="color:var(--success); font-size:0.7rem; font-weight:bold; margin-left:10px;">✅ PROCESADO</span>`
                    : `<button class="btn-update-status" data-order-id="${order.id}" data-new-status="Completado" style="background:var(--success); color:#000; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.7rem; font-weight:bold; margin-left:10px;">MARCAR COMPLETADO</button>`;

                return `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:15px; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:5px;">
                        <div><span style="color:var(--accent); font-weight:bold;">ORDEN #${order.id}</span> <span style="font-size:0.7rem; border:1px solid ${statusColor}; color:${statusColor}; padding:2px 5px; border-radius:3px; margin-left:5px;">${order.status || 'Pendiente'}</span></div>
                        <div style="display:flex; align-items:center;">${actionBtn} <span style="color:var(--text-dim); margin-left:15px; font-size:0.8rem;">${order.displayDate || order.date.split('T')[0]}</span></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:15px;">
                        <div>
                            <h4 style="font-size:0.7rem; color:var(--text-dim); margin-bottom:5px;">DATOS CLIENTE</h4>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.shipping?.name || 'N/A'} ${copyBtn(order.shipping?.name || '', 'Nombre')}</div>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.userEmail} ${copyBtn(order.userEmail, 'Email')}</div>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.shipping?.phone || 'N/A'} ${copyBtn(order.shipping?.phone || '', 'Teléfono')}</div>
                        </div>
                        <div>
                            <h4 style="font-size:0.7rem; color:var(--text-dim); margin-bottom:5px;">DIRECCIÓN DE ENVÍO</h4>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.shipping?.address || ''} ${copyBtn(order.shipping?.address || '', 'Dirección')}</div>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.shipping?.city || ''} ${copyBtn(order.shipping?.city || '', 'Ciudad')}</div>
                            <div style="font-size:0.8rem; margin-bottom:3px;">${order.shipping?.dept || ''} ${copyBtn(order.shipping?.dept || '', 'Depto')}</div>
                        </div>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px;">
                        ${itemsHtml}
                        ${profitSection}
                    </div>
                </div>`;
            }).join('');
        }
    },

    openEditModal(id) {
        const product = productsDb[id];
        if (!product) return;

        document.getElementById('edit-id').value = id;
        document.getElementById('edit-title').value = product.title;
        document.getElementById('edit-price').value = product.price;
        document.getElementById('edit-stock').value = product.stockStatus || 'In Stock';
        document.getElementById('edit-cost').value = product.cost || ''; // Cargar costo si existe
        document.getElementById('edit-desc').value = product.desc;
        document.getElementById('edit-supplier').value = product.supplierUrl || '';
        
        // --- GESTIÓN DE GALERÍA DE IMÁGENES ---
        const imgsContainer = document.getElementById('edit-imgs-list');
        imgsContainer.innerHTML = '';
        if (!product.imgs) product.imgs = [];
        
        product.imgs.forEach((img, index) => {
            const wrapper = document.createElement('div');
            // Añadimos cursor pointer y estilos para indicar interactividad
            wrapper.style.cssText = "position:relative; width:80px; height:80px; border:1px solid var(--border); border-radius:4px; overflow:hidden; background:#000; flex-shrink:0; cursor:pointer; transition:0.2s;";
            
            // Resaltar la imagen principal (índice 0)
            if (index === 0) {
                wrapper.style.borderColor = 'var(--success)';
                wrapper.style.boxShadow = '0 0 8px rgba(0, 255, 157, 0.3)';
            } else {
                wrapper.title = "Click para establecer como PRINCIPAL";
                wrapper.onmouseenter = () => wrapper.style.borderColor = 'var(--accent)';
                wrapper.onmouseleave = () => wrapper.style.borderColor = 'var(--border)';
            }

            // Evento para establecer como principal al hacer click
            wrapper.onclick = async () => {
                if (index === 0) return; // Ya es la principal

                // Mover imagen al inicio del array
                const [selectedImg] = product.imgs.splice(index, 1);
                product.imgs.unshift(selectedImg);

                // Guardar cambios inmediatamente
                StorageService.set('nexor_products_db', productsDb);
                try {
                    await setDoc(doc(db, "products", id), productsDb[id]);
                    this.showToast('Imagen establecida como PRINCIPAL.', 'success');
                } catch (err) {
                    this.showToast('Cambio guardado localmente.', 'info');
                }
                
                this.openEditModal(id); // Refrescar vista
            };

            let content;
            if (img.startsWith('data:') || img.startsWith('http')) {
                content = `<img src="${img}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                content = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.6rem; color:var(--text-dim); text-align:center; word-break:break-all; padding:5px;">${img.replace('[ IMG_', '').replace(' ]', '')}</div>`;
            }
            wrapper.innerHTML = content;

            // Etiqueta visual para la principal
            if (index === 0) {
                const badge = document.createElement('div');
                badge.innerText = '★ MAIN';
                badge.style.cssText = "position:absolute; bottom:0; left:0; width:100%; background:var(--success); color:#000; font-size:0.5rem; text-align:center; font-weight:bold; padding:2px 0; z-index:5;";
                wrapper.appendChild(badge);
            }

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '🗑️';
            delBtn.title = "Eliminar imagen permanentemente";
            delBtn.style.cssText = "position:absolute; top:2px; right:2px; background:rgba(255, 0, 0, 0.9); color:#fff; border:none; width:24px; height:24px; cursor:pointer; font-size:12px; border-radius:4px; display:flex; align-items:center; justify-content:center; z-index:10; box-shadow: 0 2px 5px rgba(0,0,0,0.5);";
            
            delBtn.onclick = async (e) => {
                e.stopPropagation(); // Evitar que se active el click del wrapper (establecer como principal)
                e.preventDefault();
                if(confirm('¿Eliminar esta imagen permanentemente?')) {
                    product.imgs.splice(index, 1);
                    
                    // Guardar cambios inmediatamente en la base de datos
                    StorageService.set('nexor_products_db', productsDb);
                    try {
                        await setDoc(doc(db, "products", id), productsDb[id]);
                        this.showToast('Imagen eliminada.', 'success');
                    } catch (err) {
                        console.warn("Error guardando en nube:", err);
                        this.showToast('Imagen eliminada (Local).', 'info');
                    }

                    this.openEditModal(id); // Refrescar modal
                }
            };
            
            wrapper.appendChild(delBtn);
            imgsContainer.appendChild(wrapper);
        });

        // Limpiar inputs de "Agregar"
        document.getElementById('edit-img').value = '';
        document.getElementById('edit-img-file').value = ''; // Limpiar input file

        document.getElementById('edit-modal').classList.add('active');
    },

    calculateFromCost() {
        const cost = parseFloat(document.getElementById('edit-cost').value) || 0;
        const margin = parseFloat(document.getElementById('edit-margin').value) || 0;
        
        if (cost > 0) {
            // Fórmula: Costo + (Costo * Porcentaje)
            const finalPrice = cost + (cost * (margin / 100));
            document.getElementById('edit-price').value = Math.round(finalPrice);
        }
    },

    async saveProductChange() {
        const id = document.getElementById('edit-id').value;
        const title = document.getElementById('edit-title').value;
        const price = parseFloat(document.getElementById('edit-price').value);
        const stockStatus = document.getElementById('edit-stock').value;
        const cost = parseFloat(document.getElementById('edit-cost').value) || 0; // Evitar NaN
        const desc = document.getElementById('edit-desc').value;
        const img = document.getElementById('edit-img').value;
        const supplierUrl = document.getElementById('edit-supplier').value;
        const fileInput = document.getElementById('edit-img-file');
        const file = fileInput.files[0];

        const performSave = async (finalImg) => {
            if (productsDb[id]) {
                productsDb[id].title = title;
                productsDb[id].price = price;
                productsDb[id].stockStatus = stockStatus;
                productsDb[id].cost = cost; // Guardar el costo para futuras referencias
                productsDb[id].desc = desc;
                productsDb[id].supplierUrl = supplierUrl;
                
                if (finalImg || img) {
                    // Limpiar placeholders automáticos ([ IMG_... ]) al subir contenido real
                    if (productsDb[id].imgs && Array.isArray(productsDb[id].imgs)) {
                        productsDb[id].imgs = productsDb[id].imgs.filter(i => !i.toString().trim().startsWith('[ IMG_'));
                    } else {
                        productsDb[id].imgs = [];
                    }

                    if (finalImg) productsDb[id].imgs.push(finalImg);
                    else if (img) productsDb[id].imgs.push(img);
                }

                // Guardar en LocalStorage
                StorageService.set('nexor_products_db', productsDb);
                
                // Sincronizar con Firebase Firestore inmediatamente
                try {
                    await setDoc(doc(db, "products", id), productsDb[id]);
                } catch (e) {
                    console.warn("No se pudo sincronizar con la nube (Offline o Permisos):", e);
                }

                this.showToast('Producto actualizado correctamente.', 'success');
                document.getElementById('edit-modal').classList.remove('active');
                
                // Recargar para ver cambios
                setTimeout(() => window.location.reload(), 1000);
            }
        };

        if (file) {
            this.showToast("Optimizando imagen (Redimensionando)...", "info");

            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 800; // Reducir a máx 800px para asegurar que quepa en BD

                    if (width > height) {
                        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                    } else {
                        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                    }
                    
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    
                    // Comprimir a JPEG calidad 0.7 (Reduce drásticamente el peso)
                    performSave(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = readerEvent.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            await performSave(null);
        }
    },

    async deleteProduct() {
        const id = document.getElementById('edit-id').value;
        if (!id) return;

        if (confirm("¿Estás seguro de que deseas ELIMINAR este producto permanentemente de la base de datos?")) {
            try {
                // 1. Eliminar de Firebase
                await deleteDoc(doc(db, "products", id));
                // 2. Eliminar localmente
                delete productsDb[id];
                StorageService.set('nexor_products_db', productsDb);
                
                this.showToast('Producto eliminado.', 'success');
                setTimeout(() => window.location.href = 'shop.html', 1000);
            } catch (e) {
                console.error(e);
                this.showToast('Error eliminando producto.', 'error');
            }
        }
    },

    // --- DATABASE MIGRATION TOOL ---
    async adminUploadProducts() {
        if (!confirm("¿Estás seguro de que quieres subir TODOS los productos locales a Firebase? Esto podría sobrescribir datos.")) return;
        
        this.showToast("Iniciando migración a la nube...", "info");
        let count = 0;
        for (const [id, product] of Object.entries(productsDb)) {
            try {
                await setDoc(doc(db, "products", id), product);
                count++;
                console.log(`Producto subido: ${id}`);
            } catch (e) {
                console.error(`Error subiendo ${id}:`, e);
            }
        }
        this.showToast(`Migración completada. ${count} productos subidos.`, "success");
    },

    // --- COMANDO DE ACTUALIZACIÓN MASIVA (ADMIN) ---
    adminApplyGlobalMarkup(percentage) {
        if (!confirm(`⚠️ ATENCIÓN: Esto aumentará el precio de TODOS los productos un ${percentage}%. ¿Continuar?`)) return;
        
        let count = 0;
        for (const id in productsDb) {
            const product = productsDb[id];
            const oldPrice = product.price;
            const newPrice = Math.round(oldPrice * (1 + (percentage / 100)));
            product.price = newPrice;
            count++;
        }
        
        StorageService.set('nexor_products_db', productsDb);
        this.showToast(`Precios actualizados (+${percentage}%). Ejecuta App.adminUploadProducts() para guardar en la nube.`, 'success');
        setTimeout(() => window.location.reload(), 2000);
    },

    // --- HERRAMIENTA DE DEPURACIÓN ---
    adminHardReset() {
        if (confirm("⚠️ ATENCIÓN: Esto borrará TODOS los datos locales (carrito, pedidos, productos editados) y recargará la página. ¿Continuar?")) {
            localStorage.removeItem(StorageService.KEYS.CART);
            // No borramos ORDERS ni USER porque ahora están en la nube/auth
            localStorage.removeItem('nexor_products_db'); // Clave específica de productos
            this.showToast('Datos locales eliminados. Recargando...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        }
    },

    // --- LIMPIEZA DE PRECIOS ERRÓNEOS (FIREBASE) ---
    async adminDeleteErroneousPrices() {
        if (!confirm("⚠️ ATENCIÓN: Esto eliminará PERMANENTEMENTE de Firebase todos los productos con precios menores a $1000. ¿Continuar?")) return;

        this.showToast("Escaneando base de datos...", "info");
        
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const deletePromises = [];
            let count = 0;

            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                // Criterio: Precio menor a 1000 (ej: 320)
                if (data.price < 1000) {
                    console.log(`Eliminando: ${data.title} (${data.price})`);
                    deletePromises.push(deleteDoc(doc(db, "products", docSnapshot.id)));
                    count++;
                }
            });

            if (count > 0) {
                await Promise.all(deletePromises);
                this.showToast(`Éxito: ${count} productos eliminados.`, "success");
                // Limpiar localmente también
                Object.keys(productsDb).forEach(k => {
                    if (productsDb[k].price < 1000) delete productsDb[k];
                });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                this.showToast("No se encontraron productos con precios erróneos.", "success");
            }
        } catch (error) {
            console.error("Error limpiando DB:", error);
            this.showToast("Error al conectar con Firebase.", "error");
        }
    },

    // --- SYNC WITH FIREBASE ---
    async fetchProductsFromDB() {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Sobrescribir datos locales con los de la nube (Filtrando precios raros < 1000)
                    if (data.price >= 1000) {
                        productsDb[doc.id] = data;
                    }
                });
                console.log("Catálogo sincronizado con Firebase.");
                this.router(); // Refrescar la vista actual con los nuevos datos
            }
        } catch (e) {
            console.log("Usando catálogo local (Offline/Error):", e);
        }
    },

    // --- CARGADORES DE PÁGINA ---

    initShopPage() {
        const params = new URLSearchParams(window.location.search);
        const cat = params.get('category') || 'all';

        const titleEl = document.querySelector('.shop-main .main-title');
        if (titleEl) {
            titleEl.innerText = CONFIG.CATALOG_TITLES[cat] || CONFIG.DEFAULT_CATALOG_TITLE;
        }

        const preTitleEl = document.querySelector('.shop-main .pre-title');
        if (preTitleEl) {
            preTitleEl.innerText = `// SECTION // ${cat.toUpperCase()}`;
        }

        this.filterProducts(cat);
        this.renderCategoryFilters(cat);
    },

    getFilteredProducts(category) {
        // Filtrar entradas inválidas primero (Protección contra corrupción de datos)
        const allEntries = Object.entries(productsDb).filter(([, p]) => p && typeof p === 'object');
        
        if (category === 'all') return allEntries;
        
        return allEntries.filter(([, p]) => {
            if (!p.tag) return false; // Si no tiene tag, no se muestra
            if (category === 'hardware') return p.tag.startsWith('HARDWARE');
            if (category === 'software') return p.tag.includes('CUSTOM_DEV') || p.tag.includes('SAAS_PLATFORM');
            if (category === 'infrastructure') return p.tag.includes('TECHNICAL_SUPPORT') || p.tag.includes('SECURITY_AUDIT') || p.tag.includes('CLOUD_OPS');
            return p.tag.toLowerCase().includes(category);
        });
    },

    filterProducts(category) {
        const filteredEntries = this.getFilteredProducts(category);
        this.renderProducts(filteredEntries, category);
    },

    renderProducts(productsEntries, category) {
        const container = this.DOMElements.productGrid;
        if (!container) return;

        if (productsEntries.length === 0) {
            container.innerHTML = '<p class="empty-history">No se encontraron productos que coincidan con el filtro.</p>';
        } else if (category === 'hardware') {
            // Agrupación por subcategoría para Hardware
            const groups = {};
            productsEntries.forEach(([id, product]) => {
                // FIX: Protección robusta para tags faltantes
                const tag = product.tag || 'HARDWARE // GENERAL';
                const parts = tag.split(' // ');
                const subCat = parts.length > 1 ? parts[1] : 'GENERAL';
                if (!groups[subCat]) groups[subCat] = [];
                groups[subCat].push([id, product]);
            });

            const sortedGroups = Object.keys(groups).sort();
            let html = '';
            
            sortedGroups.forEach(groupName => {
                const items = groups[groupName];
                const displayTitle = groupName.replace(/_/g, ' ');
                
                html += `
                    <div class="product-group" style="margin-bottom: 4rem;">
                        <h2 style="font-family: var(--font-title); color: #fff; font-size: 1.5rem; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px;">
                            <span style="color: var(--accent); font-size: 1rem;">//</span> ${displayTitle}
                        </h2>
                        <div style="display: flex; flex-direction: column; gap: 2rem;">
                            ${items.map(([id, product]) => View.productCard(product, id)).join('')}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        } else {
            container.innerHTML = productsEntries.map(([id, product]) => View.productCard(product, id)).join('');
        }
    },

    renderCategoryFilters(category) {
        const container = document.getElementById('category-filters');
        if (!container) return;
        
        container.innerHTML = ''; 

        // Obtener productos filtrados para extraer subcategorías
        const allProducts = this.getFilteredProducts(category);
        const subCats = new Set();
        
        allProducts.forEach(([, p]) => {
            if (p.tag) {
                const parts = p.tag.split(' // ');
                if (parts.length > 1) subCats.add(parts[1]);
            }
        });

        if (subCats.size === 0) {
             container.style.display = 'none';
             return;
        }
        container.style.display = 'flex';

        // Botón "TODOS"
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.innerText = 'TODOS';
        allBtn.onclick = () => {
            this.filterProducts(category);
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
        };
        container.appendChild(allBtn);

        // Botones de Subcategorías
        Array.from(subCats).sort().forEach(subCat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.innerText = subCat.replace(/_/g, ' ');
            btn.onclick = () => {
                const filtered = allProducts.filter(([, p]) => p.tag.includes(subCat));
                this.renderProducts(filtered, category);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            container.appendChild(btn);
        });
    },

    loadCheckoutPage() {
        if (this.state.cart.length === 0) {
            this.showToast("Tu carrito está vacío. Redirigiendo...", "error");
            setTimeout(() => window.location.href = "shop.html", 2000);
            return;
        }

        this.DOMElements.checkoutItems.innerHTML = this.state.cart.map(item => View.checkoutItem(item)).join('');
        const total = this.state.cart.reduce((sum, item) => sum + item.price, 0);
        this.DOMElements.checkoutTotal.innerText = formatPrice(total);
        
        // Actualizar número de Nequi en la interfaz visualmente
        const nequiDisplay = document.getElementById('nequi-number-display');
        if (nequiDisplay) {
            const p = CONFIG.NEQUI.PHONE;
            nequiDisplay.innerText = p.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        }

        // Generar QR Dinámico (API QR Server) con los datos del pago
        const qrImg = document.getElementById('nequi-qr-img');
        if (qrImg) {
            const qrData = `Pagar a Nequi: ${CONFIG.NEQUI.PHONE} | Valor: ${formatPrice(total)}`;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&bgcolor=ffffff`;
        }
        
        const payBtn = document.getElementById('btn-pay-now');
        if (payBtn) {
            payBtn.innerText = `PAGAR ${formatPrice(total)}`;
        }
        
        if (this.state.currentUser) {
            this.DOMElements.checkoutEmail.value = this.state.currentUser.email;
        }

        this.switchPaymentMethod('card');
    },

    async loadDashboard() {
        if (!this.state.currentUser) {
            window.location.href = 'index.html';
            return;
        }
        
        document.getElementById('user-name-display').innerText = this.state.currentUser.name;
        document.getElementById('user-email-display').innerText = this.state.currentUser.email;

        const container = this.DOMElements.orderHistory;
        container.innerHTML = '<div class="spinner"></div>';

        // Cargar historial real desde Firestore
        const orders = [];
        try {
            const q = query(collection(db, "orders"), where("userId", "==", this.state.currentUser.uid), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => orders.push(doc.data()));
        } catch (e) {
            console.error("Error cargando historial:", e);
        }
        
        if (orders.length === 0) {
            container.innerHTML = '<p class="empty-history">No hay pedidos registrados.</p>';
        } else {
            container.innerHTML = orders.map(order => View.orderCard(order)).join('');
        }
    },

    loadProductDetail() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const product = productsDb[id];

        if (!product) {
            // FIX: Mostrar overlay de carga SIN destruir el DOM (para que no fallen los selectores luego)
            let loadingOverlay = document.getElementById('product-loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'product-loading-overlay';
                loadingOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:var(--bg); z-index:2000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-dim);";
                loadingOverlay.innerHTML = '<h2>Sincronizando con la nube...</h2><div class="spinner" style="margin-top:20px; border-top-color:var(--accent);"></div>';
                document.body.appendChild(loadingOverlay);
            }
            
            // Timeout de seguridad por si realmente no existe después de 5 segundos
            setTimeout(() => {
                if (!productsDb[id]) {
                    window.location.href = 'shop.html';
                }
            }, 5000);
            return;
        }

        // Si existe el overlay de carga (por si vino de un re-intento), quitarlo
        const existingOverlay = document.getElementById('product-loading-overlay');
        if (existingOverlay) existingOverlay.remove();

        document.title = `${product.title} | NEXOR STORE`;
        document.querySelector('.detail-tag').innerText = product.tag;
        document.querySelector('h1').innerText = product.title;
        document.querySelector('.sku').innerText = `SKU: ${product.sku}`;

        const stockStatus = product.stockStatus || 'In Stock';
        let stockColor = 'var(--success)';
        if (stockStatus === 'Low Stock') stockColor = '#ff9900';
        if (stockStatus === 'Out of Stock') stockColor = '#ff4444';
        const isOutOfStock = stockStatus === 'Out of Stock';
        const priceHtml = View.priceDisplay(product, false).replace('price-container', 'price-container-detail').replace('original-price', 'original-price-detail').replace('sale-price-wrapper', 'sale-price-wrapper-detail').replace('sale-price', 'sale-price-detail').replace('discount-badge', 'discount-badge-detail');
        document.querySelector('.price').innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${priceHtml}
                <span style="font-size:0.9rem; color:var(--success); font-family:var(--font-code);">🚚 ${product.delivery || 'Envío calculado en checkout'}</span>
                <span style="font-size:0.9rem; color:${stockColor}; font-family:var(--font-code); font-weight:bold;">${stockStatus.toUpperCase()}</span>
            </div>
        `;
        document.querySelector('.description').innerText = product.desc;

        // Inyectar botón de editar en detalle si es admin
        const detailInfo = document.querySelector('.product-detail-info');
        // Limpiar botones de editar previos para evitar duplicados
        detailInfo.querySelectorAll('.btn-edit-product').forEach(btn => btn.remove());

        detailInfo.style.position = 'relative';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-product';
        editBtn.dataset.id = id;
        editBtn.innerText = '✏️ EDITAR DATOS';
        detailInfo.appendChild(editBtn);

        // Inyectar botón de proveedor en detalle (Visible solo en admin)
        if (product.supplierUrl) {
            const supplierInfo = getSupplierUI(product.supplierUrl);
            const supplierLink = document.createElement('a');
            supplierLink.href = product.supplierUrl;
            supplierLink.target = '_blank';
            supplierLink.className = 'btn-supplier-link';
            supplierLink.innerHTML = `${supplierInfo.icon} VER EN ${supplierInfo.name.toUpperCase()}`;
            supplierLink.style.borderColor = supplierInfo.color;
            supplierLink.style.color = supplierInfo.name === 'Proveedor' ? 'var(--accent)' : supplierInfo.color;
            supplierLink.style.marginLeft = '10px';
            detailInfo.appendChild(supplierLink);
        }

        const btnAdd = document.querySelector('.btn-add-large');
        btnAdd.dataset.title = product.title;
        btnAdd.dataset.price = product.price;
        if (isOutOfStock) {
            btnAdd.disabled = true;
            btnAdd.innerText = 'AGOTADO';
        } else {
            btnAdd.disabled = false;
            btnAdd.innerText = 'AÑADIR AL CARRITO';
        }

        // Render Main Image (Check if it's URL/Base64 or Text Placeholder)
        if (product.imgs && product.imgs.length > 0) {
            const mainImgContent = product.imgs[0];
            if (mainImgContent.startsWith('data:') || mainImgContent.startsWith('http')) {
                this.DOMElements.mainImage.innerHTML = `<img src="${mainImgContent}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
            } else {
                this.DOMElements.mainImage.innerText = mainImgContent;
            }
        } else {
            this.DOMElements.mainImage.innerText = 'SIN IMAGEN';
        }
        
        const thumbsContainer = document.querySelector('.thumbnails');
        if (thumbsContainer) {
            thumbsContainer.innerHTML = product.imgs.map((img, index) => {
                let content;
                if (img.startsWith('data:') || img.startsWith('http')) {
                    content = `<img src="${img}" style="width:100%; height:100%; object-fit:cover;">`;
                } else {
                    content = img.replace('[ IMG_', '').replace(' ]', '').split('_').pop();
                }
                return `<div class="thumb ${index === 0 ? 'active' : ''}" data-img="${img}" style="overflow:hidden;">${content}</div>`;
            }).join('');
        }

        document.querySelector('.specs-table').innerHTML = Object.entries(product.specs)
            .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
            .join('');
    },

    initHomePage() {
        // Este método encuentra las tarjetas de categoría en la página de inicio y las puebla con ejemplos de productos.
        try {
            const categoryGrid = document.querySelector('.category-section .category-grid');
            if (!categoryGrid) return; // Cláusula de guarda: solo se ejecuta en la página de inicio

            const categoryCards = categoryGrid.querySelectorAll('.category-card');

            categoryCards.forEach(card => {
                const category = card.dataset.category;
                if (!category) return;

                const productsEntries = this.getFilteredProducts(category);
                // Tomamos los primeros 3 productos (entries incluye [id, product])
                const productsToShow = productsEntries.slice(0, 3);

                const gridElement = card.querySelector('.mini-products-grid');
                if (gridElement && productsToShow.length > 0) {
                    gridElement.innerHTML = productsToShow.map(([id, p]) => View.miniProductCard(p, id)).join('');
                }
            });
        } catch (e) {
            console.error("Error inicializando home page:", e);
        }
    },

    // --- UTILIDADES UI ---
    initNeuralCanvas() {
        const canvas = document.getElementById('neural-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let points = [];
        
        const resize = () => {
            canvas.width = window.innerWidth; 
            canvas.height = window.innerHeight; 
            points = [];
            const density = window.innerWidth < 600 ? 30 : (window.innerWidth < 900 ? 50 : 100);
            for(let i=0; i<density; i++) {
                points.push({ 
                    x: Math.random()*canvas.width, 
                    y: Math.random()*canvas.height, 
                    vx: (Math.random()-0.5)*0.4, 
                    vy: (Math.random()-0.5)*0.4, 
                    r: Math.random()*2 
                });
            }
        };
        
        function draw() {
            ctx.clearRect(0,0,canvas.width, canvas.height); 
            ctx.strokeStyle = 'rgba(188, 19, 254, 0.15)'; 
            ctx.fillStyle = 'rgba(188, 19, 254, 0.4)'; 
            
            points.forEach((p, i) => { 
                p.x+=p.vx; p.y+=p.vy; 
                if(p.x<0||p.x>canvas.width)p.vx*=-1; 
                if(p.y<0||p.y>canvas.height)p.vy*=-1; 
                
                ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); 
                
                for(let j=i+1; j<points.length; j++) { 
                    let p2=points[j]; 
                    if(Math.hypot(p.x-p2.x,p.y-p2.y)<150){ 
                        ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); 
                    } 
                } 
            });
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', debounce(() => {
            if (window.innerWidth !== canvas.width || window.innerHeight !== canvas.height) {
                resize();
            }
        }, 250));

        resize();
        draw();
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    },

    // --- MANEJO DE EVENTOS ---

    handleAddToCart(button) {
        const id = button.dataset.id;
        const title = button.dataset.title;
        const price = parseFloat(button.dataset.price);
        if (title && !isNaN(price)) {
            this.addToCart(id, title, price);
        }
    },

    handleCheckoutRedirect() {
        if (this.state.cart.length === 0) {
            this.showToast('El carrito está vacío.', 'error');
        } else {
            window.location.href = 'checkout.html';
        }
    },

    handleLogout() {
        if (confirm('¿Desea cerrar sesión?')) {
            this.logout();
        }
    },

    handlePayment() {
        const form = this.DOMElements.checkoutForm;
        
        // Validar campos externos al formulario de pago
        const requiredIds = ['checkout-email', 'checkout-name', 'checkout-phone', 'checkout-address', 'checkout-city', 'checkout-dept'];
        let allValid = true;
        
        for (const id of requiredIds) {
            const el = document.getElementById(id);
            if (el && !el.checkValidity()) {
                el.reportValidity();
                allValid = false;
                break;
            }
        }

        if (allValid && form?.checkValidity()) {
            this.simulatePaymentProcess();
        } else if (allValid) {
            form?.reportValidity();
        }
    },

    initEventListeners() {
        document.addEventListener('click', e => {
            const target = e.target;

            if (target.closest('.cart-btn, .cart-close-btn, .cart-overlay')) return this.toggleCart();
            if (target.matches('.btn-remove-cart')) return this.removeFromCart(parseInt(target.dataset.index));
            if (target.matches('.btn-checkout')) return this.handleCheckoutRedirect();
            
            const addBtn = target.closest('.btn-add, .btn-add-large');
            if (addBtn) return this.handleAddToCart(addBtn);
            
            const thumb = target.closest('.thumb');
            if (thumb) return this.changeImage(thumb, thumb.dataset.img);

            // --- Lógica de Modales ---
            if (target.closest('.btn-open-auth')) return this.toggleAuthModal();
            const modalCloseBtn = target.closest('.auth-close');
            if (modalCloseBtn) {
                const modal = modalCloseBtn.closest('.auth-overlay');
                if (modal) modal.classList.remove('active');
            }

            if (target.classList.contains('auth-tab')) return this.switchAuthTab(target.dataset.tab);
            if (target.id === 'btn-logout' || target.id === 'nav-logout-btn') return this.handleLogout();

            if (target.id === 'btn-forgot-pass') {
                const email = document.querySelector('#login-form input[type="email"]').value;
                return this.resetPassword(email);
            }

            if (target.id === 'btn-google' || target.closest('#btn-google')) return this.loginWithGoogle();
            if (target.id === 'btn-microsoft' || target.closest('#btn-microsoft')) return this.loginWithMicrosoft();

            if (target.id === 'btn-pay-now') return this.handlePayment();
            if (target.classList.contains('payment-btn')) return this.switchPaymentMethod(target.dataset.method);

            // --- Lógica de Admin (Delegada) ---
            const editBtn = target.closest('.btn-edit-product');
            if (editBtn) return this.openEditModal(editBtn.dataset.id);
            const copyBtn = target.closest('.btn-copy');
            if (copyBtn) return navigator.clipboard.writeText(copyBtn.dataset.copyText).then(() => this.showToast(`Copiado: ${copyBtn.dataset.copyLabel}`, 'success'));
            const statusBtn = target.closest('.btn-update-status');
            if (statusBtn) return this.updateOrderStatus(statusBtn.dataset.orderId, statusBtn.dataset.newStatus);

            // --- Click en imagen para editar (Solo Admin) ---
            if (document.body.classList.contains('admin-mode')) {
                const productVisual = target.closest('.product-visual');
                if (productVisual) {
                    e.preventDefault(); // Evitar ir al detalle
                    const card = productVisual.closest('.product-detail-card');
                    const id = card.querySelector('.btn-edit-product')?.dataset.id;
                    if (id) return this.openEditModal(id);
                }
                
                const mainImg = target.closest('#main-image');
                if (mainImg) {
                    const editBtn = document.querySelector('.product-detail-info .btn-edit-product');
                    if (editBtn) return this.openEditModal(editBtn.dataset.id);
                }
            }

            // --- Lógica de Dropshipping (Copiar datos al ir al proveedor) ---
            const adminBuyBtn = target.closest('.btn-admin-buy');
            if (adminBuyBtn) {
                this.handleSupplierClick(adminBuyBtn.dataset.orderId);
            }

            if (target.id === 'btn-calculate-price') return this.calculateFromCost();

            if (target.closest('.mobile-menu-btn')) return this.toggleMobileMenu();
        });

        document.addEventListener('submit', e => {
            e.preventDefault();
            const form = e.target;

            if (form.id === 'login-form') {
                this.login(form.querySelector('input[type="email"]').value, form.querySelector('input[type="password"]').value);
            }

            if (form.id === 'register-form') {
                this.register(form.querySelector('input[type="text"]').value, form.querySelector('input[type="email"]').value, form.querySelector('input[type="password"]').value);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
