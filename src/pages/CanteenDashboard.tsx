import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import {
  getData, setData, genId, FoodLog, SurplusItem, User,
  predictFootfall, predictFoodQuantity, getMetrics, getRecommendations,
  addNotification, genPickupCode, useStoreListener
} from '@/lib/store';
import { toast } from 'sonner';
import {
  Leaf, LogOut, BarChart3, Plus, TrendingUp, TrendingDown, Minus, Package,
  Brain, Lightbulb, Calendar, CheckCircle2, XCircle, HeartHandshake, MessageSquare, MapPin, FileDown, Activity, ShieldCheck, Clock, ClipboardCheck, Sparkles
} from 'lucide-react';
import * as api from '@/lib/api';
import { io } from 'socket.io-client';

import QualityCheckAI from '@/components/QualityCheckAI';
import { generateFoodReport } from '@/lib/pdf';
import MapView from '@/components/MapView';
import ChatInterface from '@/components/ChatInterface';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Zap } from 'lucide-react';

/**
 * Returns the definitive expiry Date for a surplus item.
 * Priority: 1) expiresAt ISO field (set at creation), 2) compute from expiryTime relative to createdAt.
 */
function getItemExpiry(s: SurplusItem): Date {
  if (s.expiresAt) return new Date(s.expiresAt);
  const createdAt = new Date(s.createdAt || Date.now());
  if (s.expiryTime) {
    const [h, m] = s.expiryTime.split(':').map(Number);
    const expiry = new Date(createdAt);
    expiry.setHours(h, m, 0, 0);
    // If expiry falls before createdAt on the same day, it means next morning
    if (expiry <= createdAt) expiry.setDate(expiry.getDate() + 1);
    return expiry;
  }
  // Last fallback: 6 hours after creation
  return new Date(createdAt.getTime() + 6 * 3600000);
}

/** Returns true only if this item is available AND past its expiry. */
function computeIsExpired(s: SurplusItem, now: Date): boolean {
  if (s.status !== 'available') return false;
  return now > getItemExpiry(s);
}

export default function CanteenDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'input' | 'post-surplus' | 'predictions' | 'surplus' | 'analytics' | 'recommendations' | 'messages' | 'map' | 'quality-check'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [surplus, setSurplus] = useState<SurplusItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'history'>('active');
  
  const [dailyForm, setDailyForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    menuItems: '', 
    studentFootfall: '', 
    foodPrepared: '', 
    foodConsumed: '' 
  });
  
  const [surplusForm, setSurplusForm] = useState({
    food: '',
    quantity: '',
    preparedTime: '',
    expiryTime: '',
    location: ''
  });

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const surplusRes = await api.getSurplus();
      const logsRes = await api.getLogs();
      
      setSurplus(surplusRes.data.filter((s: SurplusItem) => s.canteenId === user.id));
      setLogs(logsRes.data.filter((l: FoodLog) => l.canteenId === user.id));

      if (!surplusForm.location && user.location) {
        setSurplusForm(f => ({ ...f, location: user.location! }));
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data from backend", err);
      // Fallback to local storage for demo purposes if backend is down
      setLogs((getData<FoodLog[]>('dailyLogs') || []).filter(l => l.canteenId === user.id));
      setSurplus((getData<SurplusItem[]>('surplusFood') || []).filter(s => s.canteenId === user.id));
    }
  }, [user, surplusForm.location]);

  useEffect(() => {
    if (!user || user.role !== 'canteen') { navigate('/canteen/login'); return; }
    refresh();

    // Real-time Expiry Heartbeat - Refresh UI every 30s to check if food has expired
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, navigate, refresh]);

  useStoreListener(['surplusFood', 'dailyLogs', 'chatMessages'], refresh);

  // Real-time Chat Toasts for LocalStorage mode
  useStoreListener(['chatMessages'], () => {
    if (tab !== 'messages') {
      const msgs = getData<ChatMessage[]>('chatMessages') || [];
      const last = msgs[msgs.length - 1];
      if (last && last.receiverId === user?.id && !last.read) {
         toast.info(`New message: "${last.text.substring(0, 30)}..."`, {
           description: "Click to view",
           action: { label: "View", onClick: () => setTab('messages') }
         });
      }
    }
  });

  const handleDailySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const prepared = Number(dailyForm.foodPrepared);
    const consumed = Number(dailyForm.foodConsumed);

    try {
      await api.createLog({
        date: dailyForm.date,
        menuItems: dailyForm.menuItems,
        studentFootfall: Number(dailyForm.studentFootfall),
        foodPrepared: prepared,
        foodConsumed: consumed
      });
      toast.success('Daily tracking log recorded successfully for AI predictions!');
      setDailyForm({ date: new Date().toISOString().split('T')[0], menuItems: '', studentFootfall: '', foodPrepared: '', foodConsumed: '' });
      refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save to database. Is your backend running?');
    }
  };

  const logStatusChange = (item: SurplusItem, action: string, actor: string) => {
    if (!item.logs) item.logs = [];
    item.logs.push({
      action,
      time: new Date().toISOString(),
      actor
    });
  };

  const handleSurplusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const qty = Number(surplusForm.quantity);
    if (qty <= 0) return toast.error("Quantity must be greater than 0");

    // Comprehensive Indian city database (300+ cities)
    const cityCoords: Record<string, [number, number]> = {
      // ── Tamil Nadu ──
      "Chennai": [13.0827, 80.2707], "Coimbatore": [11.0168, 76.9558], "Madurai": [9.9252, 78.1198],
      "Vellore": [12.9165, 79.1325], "Salem": [11.6643, 78.1460], "Trichy": [10.7905, 78.7047],
      "Tiruchirappalli": [10.7905, 78.7047],
      "Tiruppur": [11.1085, 77.3411],
      "Erode": [11.3410, 77.7172],
      "Thanjavur": [10.7870, 79.1378],
      "Tirunelveli": [8.7139, 77.7567],
      "Thoothukudi": [8.7642, 78.1348],
      "Tuticorin": [8.7642, 78.1348],
      "Dindigul": [10.3624, 77.9695],
      "Kancheepuram": [12.8342, 79.7036],
      "Kumbakonam": [10.9602, 79.3845],
      "Hosur": [12.7409, 77.8253],
      "Ooty": [11.4102, 76.6950],
      "Udhagamandalam": [11.4102, 76.6950],
      "Karur": [10.9601, 78.0766],
      "Sivakasi": [9.4533, 77.7989],
      "Nagercoil": [8.1833, 77.4119],
      "Cuddalore": [11.7447, 79.7689],
      "Nagapattinam": [10.7672, 79.8449],
      "Villupuram": [11.9401, 79.4927],
      "Krishnagiri": [12.5186, 78.2137],
      "Dharmapuri": [12.1279, 78.1581],
      "Ramanathapuram": [9.3750, 78.8379],
      "Pudukkottai": [10.3797, 78.8201],
      "Namakkal": [11.2195, 78.1673],
      "Virudhunagar": [9.5828, 77.9524],
      "Sivaganga": [9.8454, 78.4806],
      "Ariyalur": [11.1400, 79.0784],
      "Perambalur": [11.2333, 78.8833],
      "Theni": [10.0104, 77.4770],
      "Tenkasi": [8.9596, 77.3160],
      "Ranipet": [12.9348, 79.3328],
      "Tirupattur": [12.4965, 78.5726],
      "Chengalpattu": [12.6921, 79.9762],
      "Kallakurichi": [11.7348, 78.9615],
      "Mayiladuthurai": [11.1035, 79.6511],
      "Tiruvarur": [10.7713, 79.6367],
      "Ambur": [12.7909, 78.7178],
      "Vaniyambadi": [12.6862, 78.6194],
      "Katpadi": [12.9684, 79.1444],
      "Gudiyatham": [12.9475, 78.8737],
      "Pollachi": [10.6562, 77.0063],
      "Mettupalayam": [11.2989, 76.9331],
      "Gobichettipalayam": [11.4538, 77.3585],
      "Bhavani": [11.4500, 77.6833],
      "Arakkonam": [13.0862, 79.6706],
      "Tindivanam": [12.2396, 79.6502],
      "Gingee": [12.2525, 79.4167],
      "Karaikudi": [10.0757, 78.7738],
      "Devakottai": [9.9460, 78.8237],
      "Paramakudi": [9.5178, 78.5924],
      "Aruppukkottai": [9.5102, 78.0986],
      "Sattur": [9.3466, 77.9049],
      "Sankarankovil": [9.1658, 77.5465],
      "Kovilpatti": [9.1736, 77.8673],
      "Palayamkottai": [8.7260, 77.7376],
      "Srivilliputhur": [9.5105, 77.6343],
      "Rajapalayam": [9.4499, 77.5521],
      "Krishnarayanapuram": [10.9513, 78.2350],
      "Harur": [12.0476, 78.4785],
      "Uthangarai": [12.3175, 78.4272],
      "Palacode": [12.0175, 77.9949],
      "Pennagaram": [12.1296, 77.8970],
      "Papanasam": [10.9278, 79.2722],
      "Pattukottai": [10.4255, 79.3186],
      "Mannargudi": [10.6641, 79.4534],
      "Kelvelur": [10.9333, 79.8667],
      "Chidambaram": [11.3993, 79.6928],
      "Vikravandi": [11.9481, 79.5213],
      "Sankarapuram": [11.8862, 79.0113],
      "Ulundurpet": [11.6748, 79.3209],
      "Tirukoilur": [11.9676, 79.2003],
      "Vandavasi": [12.5090, 79.6233],
      "Cheyyar": [12.6716, 79.5418],
      "Thiruvannamalai": [12.2253, 79.0747],
      "Polur": [12.5218, 79.1367],
      "Walajapet": [12.9243, 79.3622],
      "Sholinghur": [13.1220, 79.4231],
      "Nagerecoil": [8.1833, 77.4119],
      "Kanyakumari": [8.0883, 77.5385],
      "Ambasamudram": [8.7031, 77.4520],
      "Attur": [11.5970, 78.5973],
      "Mettur": [11.7862, 77.8011],

      // ── Andhra Pradesh ──
      "Visakhapatnam": [17.6868, 83.2185],
      "Vizag": [17.6868, 83.2185],
      "Vijayawada": [16.5062, 80.6480],
      "Guntur": [16.3067, 80.4365],
      "Nellore": [14.4426, 79.9865],
      "Kurnool": [15.8281, 78.0373],
      "Rajahmundry": [17.0005, 81.8040],
      "Kakinada": [16.9891, 82.2475],
      "Tirupati": [13.6288, 79.4192],
      "Anantapur": [14.6819, 77.6006],
      "Kadapa": [14.4753, 78.8324],
      "Eluru": [16.7107, 81.0952],
      "Ongole": [15.5057, 80.0499],
      "Vizianagaram": [18.1066, 83.3956],
      "Srikakulam": [18.2969, 83.8974],
      "Chittoor": [13.2172, 79.1003],
      "Machilipatnam": [16.1875, 81.1389],
      "Bhimavaram": [16.5449, 81.5212],
      "Narsipatnam": [17.6650, 82.6119],
      "Proddatur": [14.7500, 78.5500],
      "Hindupur": [13.8290, 77.4911],

      // ── Karnataka ──
      "Bangalore": [12.9716, 77.5946],
      "Bengaluru": [12.9716, 77.5946],
      "Mysore": [12.2958, 76.6394],
      "Mysuru": [12.2958, 76.6394],
      "Hubli": [15.3647, 75.1240],
      "Dharwad": [15.4589, 75.0078],
      "Mangalore": [12.9141, 74.8560],
      "Belgaum": [15.8497, 74.4977],
      "Belagavi": [15.8497, 74.4977],
      "Gulbarga": [17.3297, 76.8343],
      "Kalaburagi": [17.3297, 76.8343],
      "Davanagere": [14.4644, 75.9218],
      "Shimoga": [13.9299, 75.5681],
      "Shivamogga": [13.9299, 75.5681],
      "Tumkur": [13.3409, 77.1013],
      "Raichur": [16.2120, 77.3439],
      "Bidar": [17.9104, 77.5199],
      "Hospet": [15.2689, 76.3870],
      "Gadag": [15.4315, 75.6226],
      "Udupi": [13.3409, 74.7421],
      "Hassan": [13.0068, 76.1004],
      "Mandya": [12.5218, 76.8951],
      "Chikkamagaluru": [13.3153, 75.7754],
      "Kolar": [13.1367, 78.1294],
      "Chitradurga": [14.2306, 76.3983],
      "Koppal": [15.3526, 76.1551],
      "Bijapur": [16.8302, 75.7100],
      "Vijayapura": [16.8302, 75.7100],
      "Bellary": [15.1394, 76.9214],
      "Ballari": [15.1394, 76.9214],

      // ── Kerala ──
      "Thiruvananthapuram": [8.5241, 76.9366],
      "Trivandrum": [8.5241, 76.9366],
      "Kochi": [9.9312, 76.2673],
      "Ernakulam": [9.9816, 76.2999],
      "Kozhikode": [11.2588, 75.7804],
      "Calicut": [11.2588, 75.7804],
      "Thrissur": [10.5276, 76.2144],
      "Kollam": [8.8932, 76.6141],
      "Palakkad": [10.7867, 76.6548],
      "Alappuzha": [9.4981, 76.3388],
      "Alleppey": [9.4981, 76.3388],
      "Kottayam": [9.5916, 76.5222],
      "Malappuram": [11.0730, 76.0740],
      "Kannur": [11.8745, 75.3704],
      "Kasaragod": [12.4996, 74.9869],
      "Pathanamthitta": [9.2648, 76.7870],
      "Idukki": [9.8485, 76.9720],
      "Wayanad": [11.6854, 76.1320],

      // ── Telangana ──
      "Hyderabad": [17.3850, 78.4867],
      "Secunderabad": [17.4399, 78.4983],
      "Warangal": [17.9784, 79.5941],
      "Nizamabad": [18.6725, 78.0942],
      "Khammam": [17.2473, 80.1514],
      "Karimnagar": [18.4386, 79.1288],
      "Ramagundam": [18.7500, 79.4700],
      "Sangareddy": [17.6241, 78.0876],
      "Mahbubnagar": [16.7488, 78.0067],
      "Nalgonda": [17.0575, 79.2677],
      "Adilabad": [19.6640, 78.5320],
      "Suryapet": [17.1399, 79.6279],

      // ── Maharashtra ──
      "Mumbai": [19.0760, 72.8777],
      "Pune": [18.5204, 73.8567],
      "Nagpur": [21.1458, 79.0882],
      "Nashik": [20.0059, 73.7919],
      "Aurangabad": [19.8762, 75.3433],
      "Solapur": [17.6805, 75.9064],
      "Kolhapur": [16.7050, 74.2433],
      "Amravati": [20.9320, 77.7523],
      "Nanded": [19.1383, 77.3210],
      "Sangli": [16.8524, 74.5815],
      "Malegaon": [20.5579, 74.5287],
      "Jalgaon": [21.0077, 75.5626],
      "Akola": [20.7002, 77.0082],
      "Latur": [18.4088, 76.5604],
      "Dhule": [20.9042, 74.7749],
      "Ahmadnagar": [19.0948, 74.7480],
      "Chandrapur": [19.9615, 79.2961],
      "Parbhani": [19.2704, 76.7767],
      "Ichalkaranji": [16.6933, 74.4612],
      "Bhiwandi": [19.2813, 73.0604],
      "Ulhasnagar": [19.2183, 73.1617],

      // ── Delhi NCR ──
      "Delhi": [28.7041, 77.1025],
      "New Delhi": [28.6139, 77.2090],
      "Gurugram": [28.4595, 77.0266],
      "Gurgaon": [28.4595, 77.0266],
      "Noida": [28.5355, 77.3910],
      "Faridabad": [28.4089, 77.3178],
      "Ghaziabad": [28.6692, 77.4538],

      // ── Gujarat ──
      "Ahmedabad": [23.0225, 72.5714],
      "Surat": [21.1702, 72.8311],
      "Vadodara": [22.3072, 73.1812],
      "Rajkot": [22.3039, 70.8022],
      "Bhavnagar": [21.7645, 72.1519],
      "Jamnagar": [22.4707, 70.0577],
      "Junagadh": [21.5222, 70.4579],
      "Gandhinagar": [23.2156, 72.6369],
      "Anand": [22.5645, 72.9289],
      "Bharuch": [21.7125, 72.9958],

      // ── Rajasthan ──
      "Jaipur": [26.9124, 75.7873],
      "Jodhpur": [26.2389, 73.0243],
      "Udaipur": [24.5854, 73.7125],
      "Kota": [25.2138, 75.8648],
      "Bikaner": [28.0229, 73.3119],
      "Ajmer": [26.4499, 74.6399],
      "Bhilwara": [25.3407, 74.6313],
      "Alwar": [27.5530, 76.6346],
      "Sikar": [27.6094, 75.1397],

      // ── Madhya Pradesh ──
      "Bhopal": [23.2599, 77.4126],
      "Indore": [22.7196, 75.8577],
      "Gwalior": [26.2183, 78.1828],
      "Jabalpur": [23.1815, 79.9864],
      "Ujjain": [23.1760, 75.7885],
      "Sagar": [23.8388, 78.7378],
      "Ratlam": [23.3315, 75.0367],
      "Satna": [24.6005, 80.8322],

      // ── Uttar Pradesh ──
      "Lucknow": [26.8467, 80.9462],
      "Kanpur": [26.4499, 80.3319],
      "Agra": [27.1767, 78.0081],
      "Varanasi": [25.3176, 82.9739],
      "Meerut": [28.9845, 77.7064],
      "Prayagraj": [25.4358, 81.8463],
      "Allahabad": [25.4358, 81.8463],
      "Bareilly": [28.3670, 79.4304],
      "Aligarh": [27.8974, 78.0880],
      "Moradabad": [28.8359, 78.7735],
      "Gorakhpur": [26.7606, 83.3731],
      "Saharanpur": [29.9640, 77.5460],
      "Jhansi": [25.4484, 78.5685],
      "Muzaffarnagar": [29.4727, 77.7085],
      "Mathura": [27.4924, 77.6737],

      // ── Punjab ──
      "Ludhiana": [30.9010, 75.8573],
      "Amritsar": [31.6340, 74.8723],
      "Jalandhar": [31.3260, 75.5762],
      "Patiala": [30.3398, 76.3869],
      "Bathinda": [30.2100, 74.9455],
      "Mohali": [30.7046, 76.7179],

      // ── Haryana ──
      "Chandigarh": [30.7333, 76.7794],
      "Panipat": [29.3909, 76.9635],
      "Ambala": [30.3782, 76.7767],
      "Rohtak": [28.8955, 76.6066],
      "Hisar": [29.1492, 75.7217],
      "Karnal": [29.6857, 76.9907],

      // ── Bihar ──
      "Patna": [25.5941, 85.1376],
      "Gaya": [24.7914, 85.0002],
      "Bhagalpur": [25.2425, 87.0145],
      "Muzaffarpur": [26.1209, 85.3647],
      "Darbhanga": [26.1103, 85.8959],
      "Purnia": [25.7771, 87.4753],

      // ── West Bengal ──
      "Kolkata": [22.5726, 88.3639],
      "Howrah": [22.5867, 88.3174],
      "Durgapur": [23.5204, 87.3119],
      "Asansol": [23.6739, 86.9524],
      "Siliguri": [26.7271, 88.3953],
      "Kharagpur": [22.3302, 87.3237],

      // ── Odisha ──
      "Bhubaneswar": [20.2961, 85.8245],
      "Cuttack": [20.4625, 85.8830],
      "Rourkela": [22.2604, 84.8536],
      "Berhampur": [19.3150, 84.7941],
      "Sambalpur": [21.4669, 83.9812],

      // ── Assam & Northeast ──
      "Guwahati": [26.1445, 91.7362],
      "Silchar": [24.8333, 92.7789],
      "Dibrugarh": [27.4728, 94.9120],
      "Jorhat": [26.7509, 94.2037],
      "Shillong": [25.5788, 91.8831],
      "Imphal": [24.8170, 93.9368],
      "Agartala": [23.8315, 91.2868],
      "Kohima": [25.6751, 94.1086],
      "Aizawl": [23.7271, 92.7176],
      "Itanagar": [27.0844, 93.6053],
      "Gangtok": [27.3314, 88.6138],

      // ── Jharkhand ──
      "Ranchi": [23.3441, 85.3096],
      "Jamshedpur": [22.8046, 86.2029],
      "Dhanbad": [23.7957, 86.4304],
      "Bokaro": [23.6693, 86.1511],
      "Deoghar": [24.4833, 86.7000],

      // ── Chhattisgarh ──
      "Raipur": [21.2514, 81.6296],
      "Bhilai": [21.1938, 81.3509],
      "Bilaspur": [22.0797, 82.1391],
      "Korba": [22.3595, 82.7501],

      // ── Uttarakhand & Himachal ──
      "Dehradun": [30.3165, 78.0322],
      "Haridwar": [29.9457, 78.1642],
      "Roorkee": [29.8543, 77.8880],
      "Shimla": [31.1048, 77.1734],
      "Dharamshala": [32.2190, 76.3234],

      // ── J&K ──
      "Srinagar": [34.0837, 74.7973],
      "Jammu": [32.7266, 74.8570],
    };

    // Normalize input
    const normalized = surplusForm.location.trim() || 'Mumbai';
    const exactKey = Object.keys(cityCoords).find(
      k => k.toLowerCase() === normalized.toLowerCase()
    );

    let lat = 19.0760;
    let lng = 72.8777;

    if (exactKey) {
      lat = cityCoords[exactKey][0] + (Math.random() * 0.01 - 0.005);
      lng = cityCoords[exactKey][1] + (Math.random() * 0.01 - 0.005);
    }

    try {
      await api.createSurplus({
        food: surplusForm.food,
        quantity: qty,
        preparedTime: surplusForm.preparedTime,
        expiryTime: surplusForm.expiryTime,
        location: normalized,
        lat,
        lng
      });
      toast.success('Surplus food posted to Live Marketplace!');
      setSurplusForm({ food: '', quantity: '', preparedTime: '', expiryTime: '', location: user.location || '' });
      setTab('surplus');
      refresh();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'Failed to post surplus to backend.';
      toast.error(msg);
    }
  };

  const approveRequest = async (id: string) => {
    try {
      await api.updateSurplus(id, {
        status: 'approved',
        contact: user.phone || '9876543210',
        pickupTime: 'Within 1 hour',
        action: 'approved',
        actor: 'Canteen'
      });
      toast.success('NGO request approved!');
      refresh();
    } catch(err) {
      toast.error('Failed to approve request.');
    }
  };

  const rejectRequest = async (id: string, requestedById: string) => {
    try {
      await api.updateSurplus(id, {
        status: 'available',
        requestedBy: null,
        requestedByName: null,
        action: 'rejected_request_from_' + requestedById,
        actor: 'Canteen'
      });
      toast.success('Request rejected. The item is now available for others.');
      refresh();
    } catch(err) {
      toast.error('Failed to reject request.');
    }
  };

  const markComplete = async (id: string) => {
    try {
      await api.updateSurplus(id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        action: 'completed',
        actor: 'System'
      });
      toast.success('Pickup marked as completed backend-verified!');
      refresh();
    } catch(err) {
      toast.error('Failed to complete pickup.');
    }
  };

  const downloadReport = (item: SurplusItem) => {
    const allUsers = getData<User[]>('users') || [];
    generateFoodReport(item, allUsers);
  };

  if (!user) return null;

  const prediction = predictFootfall(user.id, logs);
  const predictedFood = predictFoodQuantity(user.id, logs);
  const metrics = getMetrics(logs, surplus);
  const recs = getRecommendations(user.id, logs);

  const chartData = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map(l => ({
    date: new Date(l.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    prepared: l.foodPrepared, consumed: l.foodConsumed, surplus: l.surplus, footfall: l.studentFootfall,
  }));

  const trendIcon = prediction.trend === 'increasing' ? <TrendingUp className="w-4 h-4 text-primary" /> :
    prediction.trend === 'decreasing' ? <TrendingDown className="w-4 h-4 text-secondary" /> :
    <Minus className="w-4 h-4 text-muted-foreground" />;

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'input' as const, label: 'Daily Log', icon: Plus },
    { id: 'quality-check' as const, label: 'Quality Check AI', icon: Activity },
    { id: 'post-surplus' as const, label: 'Post Surplus', icon: HeartHandshake },
    { id: 'surplus' as const, label: 'Active Surplus', icon: Package },
    { id: 'map' as const, label: 'Map View', icon: MapPin },
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare },
    { id: 'predictions' as const, label: 'Predictions', icon: Brain },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'recommendations' as const, label: 'Smart Tips', icon: Lightbulb },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-card/80 backdrop-blur-xl border-r border-border/50 flex flex-col flex-shrink-0 z-20`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && 'justify-center w-full'}`}>
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            {isSidebarOpen && (
              <div>
                <span className="font-bold text-sm gradient-text">Food Loop</span>
              </div>
            )}
          </div>
        </div>
        {isSidebarOpen && (
          <div className="px-6 py-4 border-b border-border/50">
            <div className="font-medium truncate" title={user.organization}>{user.organization}</div>
            <div className="text-xs text-muted-foreground capitalize">{user.role} Dashboard</div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center w-full rounded-lg text-sm font-medium transition-all ${isSidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-3'} ${tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              title={!isSidebarOpen ? t.label : ''}
            >
              <t.icon className="w-4 h-4 flex-shrink-0" /> {isSidebarOpen && t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border/50 space-y-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex items-center w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${isSidebarOpen ? 'gap-2 px-3 py-2' : 'justify-center p-3'}`} title="Toggle Sidebar">
            {isSidebarOpen ? <Minus className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
            {isSidebarOpen && "Collapse"}
          </button>
          <button onClick={() => { logout(); navigate('/canteen/login'); }} className={`flex items-center w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${isSidebarOpen ? 'gap-2 px-3 py-2' : 'justify-center p-3'}`} title="Logout">
            <LogOut className="w-4 h-4" /> {isSidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
        {/* Overview */}
        {/* Story-Based Impact Overview */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Impact Hero Banner */}
            <div className="relative overflow-hidden rounded-[2rem] p-8 md:p-12 border border-primary/20 shadow-2xl shadow-primary/5">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-orange-500/5 to-amber-500/10" />
              <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                <Leaf className="w-48 h-48 text-emerald-500/20 rotate-12" />
              </div>
              
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-600 text-xs font-black uppercase tracking-widest border border-emerald-500/20">
                    🌍 Sustainability Hero
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight">
                  Your Impact <span className="text-emerald-600">This Month</span>
                </h1>
                <p className="text-xl text-muted-foreground font-medium mb-8">
                  You are making a real impact ❤️. Every meal you share creates a better world for our community and our planet.
                </p>

                {/* Progress Visualization */}
                <div className="mb-10 p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-sm font-black uppercase tracking-widest text-emerald-700">Mission: 1,000 Meals</div>
                    <div className="text-xs font-bold text-muted-foreground italic">Target Progress: {Math.floor((metrics.totalFoodSaved * 2 / 1000) * 100)}%</div>
                  </div>
                  <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden border border-border/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (metrics.totalFoodSaved * 2 / 1000) * 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 group relative"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                  <p className="mt-4 text-xs font-bold text-emerald-700/60 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Keep going! You're saving lives and the environment.
                  </p>
                </div>

                {/* Story Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { story: `You served ${Math.floor(metrics.totalFoodSaved * 2)} meals to people in need`, icon: "🍽", color: "bg-orange-500" },
                    { story: `You saved ${(metrics.totalFoodSaved * 2.5).toFixed(1)}kg of CO₂ emissions`, icon: "🌱", color: "bg-emerald-500" },
                    { story: `You reduced ${metrics.totalFoodSaved}kg of food waste`, icon: "♻", color: "bg-amber-500" },
                    { story: `You supported 3 NGOs this month`, icon: "🤝", color: "bg-blue-500" },
                  ].map((s, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 hover:bg-white/80 transition-all border border-white/50 shadow-sm group cursor-pointer"
                    >
                      <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-xl shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
                        {s.icon}
                      </div>
                      <div className="text-sm font-bold leading-snug">{s.story}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Insights Bar (Secondary Metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest text-emerald-700/60 transition-colors">Kitchen Intelligence</div>
                </div>
                <div className="text-2xl font-black text-emerald-700">{prediction.predicted} <span className="text-sm font-bold text-muted-foreground">People</span></div>
                <div className="flex items-center gap-2 mt-2">
                   {trendIcon} <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Expected Student Footfall</span>
                </div>
              </div>

              <div className="glass-card p-6 border-orange-500/20 bg-orange-500/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest text-orange-700/60 transition-colors">AI Smart Recommendation</div>
                </div>
                <div className="text-2xl font-black text-orange-700">{predictedFood} kg</div>
                <div className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest italic">Optimal Batch Size for Today</div>
              </div>

              <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest text-amber-700/60 transition-colors">Available Surplus</div>
                </div>
                <div className="text-2xl font-black text-amber-700">{surplus.filter(s=>s.status==='available').reduce((a,b)=>a+b.quantity, 0)} kg</div>
                <div className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest italic">Actively Shared with NGOs</div>
              </div>
            </div>

            {/* Recent Logs */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Recent Daily Logs</h3>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No predictive logs yet. Add your first daily log!</p>
              ) : (
                <div className="space-y-3">
                  {[...logs].reverse().slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{l.menuItems}</div>
                        <div className="text-xs text-muted-foreground">{l.date} · {l.studentFootfall} people</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{l.foodPrepared} kg prepared</div>
                        <div className={`text-xs ${l.surplus > 10 ? 'text-secondary' : 'text-primary'}`}>
                          {l.surplus > 0 ? `${l.surplus} kg unconsumed` : 'Perfect prep'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Chart */}
            {chartData.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Wastage Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="surplusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="surplus" stroke="hsl(145, 65%, 42%)" fill="url(#surplusGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* Daily Input - FOR PREDICTION ONLY */}
        {tab === 'input' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="max-w-2xl mx-auto glass-card p-8">
              <h2 className="section-title mb-2 flex items-center gap-2"><Plus className="w-6 h-6 text-primary" /> Prediction Log Module</h2>
              <p className="text-sm text-muted-foreground mb-6">Store daily food data securely to feed the AI prediction engine.</p>
              
              <form onSubmit={handleDailySubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date</label>
                    <input type="date" value={dailyForm.date} onChange={e => setDailyForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Menu Items</label>
                    <input value={dailyForm.menuItems} onChange={e => setDailyForm(f => ({ ...f, menuItems: e.target.value }))} className="input-field" placeholder="Rice, Dal, Sabzi" required />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">Student Footfall <span className="text-primary text-xs">(Predicted: {prediction.predicted})</span></label>
                  <input type="number" value={dailyForm.studentFootfall} onChange={e => setDailyForm(f => ({ ...f, studentFootfall: e.target.value }))} className="input-field" placeholder="How many students actually ate?" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Food Prepared (kg)</label>
                    <input type="number" value={dailyForm.foodPrepared} onChange={e => setDailyForm(f => ({ ...f, foodPrepared: e.target.value }))} className="input-field" placeholder={`AI Recommends: ${predictedFood}`} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Food Consumed (kg)</label>
                    <input type="number" value={dailyForm.foodConsumed} onChange={e => setDailyForm(f => ({ ...f, foodConsumed: e.target.value }))} className="input-field" required />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full mt-4">Save Daily Data</button>
              </form>
            </div>
          </motion.div>
        )}

        {/* Post Surplus - NGO MODULE */}
        {tab === 'post-surplus' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="max-w-2xl mx-auto glass-card border-secondary/30 p-8 shadow-[0_0_15px_rgba(255,165,0,0.05)]">
              <h2 className="section-title mb-2 flex items-center gap-2"><HeartHandshake className="w-6 h-6 text-secondary" /> NGO Redistribution Module</h2>
              <p className="text-sm text-muted-foreground mb-6">Post clean, untouched surplus food here so registered NGOs can request a pickup.</p>
              
              <form onSubmit={handleSurplusSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Food Item Name</label>
                  <input value={surplusForm.food} onChange={e => setSurplusForm(f => ({ ...f, food: e.target.value }))} className="input-field border-secondary/20 focus:border-secondary/50" placeholder="e.g. 2 Pots of Dal and Rice" required />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Quantity (kg)</label>
                  <input type="number" value={surplusForm.quantity} onChange={e => setSurplusForm(f => ({ ...f, quantity: e.target.value }))} className="input-field border-secondary/20 focus:border-secondary/50" placeholder="Ex: 15" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Prepared Time</label>
                    <input type="time" value={surplusForm.preparedTime} onChange={e => setSurplusForm(f => ({ ...f, preparedTime: e.target.value }))} className="input-field border-secondary/20 focus:border-secondary/50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 flex items-center justify-between">
                      Expiry Time 
                      <span className="text-[10px] text-muted-foreground font-normal">24h Format (e.g. 18:30)</span>
                    </label>
                    <input type="time" value={surplusForm.expiryTime} onChange={e => setSurplusForm(f => ({ ...f, expiryTime: e.target.value }))} className="input-field border-secondary/20 focus:border-secondary/50" required />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Pickup Location</label>
                  <input value={surplusForm.location} onChange={e => setSurplusForm(f => ({ ...f, location: e.target.value }))} className="input-field border-secondary/20 focus:border-secondary/50" placeholder="e.g. Back Gate, Block B" required />
                </div>

                <button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-3 rounded-lg font-medium transition-all shadow-lg active:scale-[0.98] mt-4">
                  Post Immediately
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* Surplus Status Viewing */}
        {tab === 'surplus' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
              <div>
                <h2 className="section-title flex items-center gap-2 regular"><Package className="w-6 h-6 text-primary" /> Surplus Listings</h2>
                <p className="text-sm text-muted-foreground">Monitor and coordinate your active food redistributions.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50 mr-2">
                  <button onClick={() => setActiveSubTab('active')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeSubTab === 'active' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Active Pickups</button>
                  <button onClick={() => setActiveSubTab('history')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeSubTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Pickup History</button>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                  <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Grid</button>
                  <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'map' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Map</button>
                </div>
              </div>
            </div>
            
            {viewMode === 'map' ? (
              <div className="space-y-4">
                <MapView items={surplus} />
              </div>
            ) : surplus.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground flex flex-col items-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
                No active listings. Use the 'Post Surplus' tab to trigger requests.
              </div>
            ) : (
              <div className="grid gap-4">
               {[...surplus].reverse().filter(s => {
                 const now = new Date();
                 const isExpired = computeIsExpired(s, now);
                 
                 if (activeSubTab === 'active') {
                   return ['available', 'requested', 'approved', 'on_the_way'].includes(s.status) && !isExpired;
                 } else {
                   return s.status === 'completed' || isExpired;
                 }
               }).map(s => {
                  const now = new Date();
                  const isExpired = computeIsExpired(s, now);
                  const itemExpiry = getItemExpiry(s);

                  // Time remaining calculation
                  const diff = itemExpiry.getTime() - now.getTime();
                  const minsRemaining = Math.max(0, Math.floor(diff / 60000));
                  const hoursRemaining = Math.floor(minsRemaining / 60);
                  const displayTime = hoursRemaining > 0 
                    ? `${hoursRemaining}h ${minsRemaining % 60}m` 
                    : `${minsRemaining}m`;
                  
                  let colorClasses = "bg-primary/20 text-primary border-primary/30";
                  let dotColor = "bg-primary";
                  let statusLabel = "Available";
                  
                  if (s.status === 'completed') {
                    colorClasses = "bg-muted text-muted-foreground border-border";
                    dotColor = "bg-muted-foreground";
                    statusLabel = "Completed";
                  } else if (s.status === 'requested') {
                    colorClasses = "bg-orange-500/20 text-orange-500 border-orange-500/30";
                    dotColor = "bg-orange-500";
                    statusLabel = `Requested by ${s.requestedByName || "NGO"}`;
                  } else if (s.status === 'approved') {
                    colorClasses = "bg-blue-500/20 text-blue-500 border-blue-500/30";
                    dotColor = "bg-blue-500";
                    statusLabel = "Approved - Awaiting pickup";
                  } else if (s.status === 'on_the_way') {
                    colorClasses = "bg-purple-500/20 text-purple-500 border-purple-500/30";
                    dotColor = "bg-purple-500";
                    statusLabel = "On the way 🚚";
                  } else if (isExpired) {
                    colorClasses = "bg-red-500/20 text-red-500 border-red-500/30";
                    dotColor = "bg-red-500";
                    statusLabel = "Expired";
                  }

                  return (
                    <div key={s.id} className="glass-card p-5 overflow-hidden">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                          <div className="font-semibold text-lg">{s.food}</div>
                          <div className="text-sm text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-2 items-center">
                            <span className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded border border-border/50 text-foreground font-medium">
                              <Package className="w-3.5 h-3.5 text-primary" /> {s.quantity} kg
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Posted @ {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isExpired && s.status === 'available' && (
                              <span className="flex items-center gap-1.5 text-orange-500 font-medium animate-pulse">
                                <Zap className="w-3.5 h-3.5" /> Expires in {displayTime}
                              </span>
                            )}
                            {isExpired && <span className="text-red-500 font-bold">Expired</span>}
                          </div>
                        </div>
                       
                       <div className="flex items-center gap-4 border-t md:border-none border-border/50 pt-4 md:pt-0">
                         <div className={`px-3 py-1.5 rounded-full border ${colorClasses} text-xs font-medium flex items-center gap-2 shadow-sm`}>
                           <div className={`w-2 h-2 rounded-full ${dotColor} ${s.status === 'available' && !isExpired ? 'animate-pulse' : ''}`}></div>
                           {statusLabel}
                         </div>
                         
                         {s.status === 'requested' && (
                           <div className="flex items-center gap-2">
                             <button 
                               onClick={() => approveRequest(s.id)}
                               className="flex items-center gap-1 text-sm bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium border border-primary/20"
                             >
                               <CheckCircle2 className="w-4 h-4" /> Approve
                             </button>
                             <button 
                               onClick={() => rejectRequest(s.id, s.requestedBy!)}
                               className="flex items-center gap-1 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-md transition-colors font-medium border border-red-500/20"
                             >
                               <XCircle className="w-4 h-4" /> Reject
                             </button>
                           </div>
                         )}

                         {s.status === 'on_the_way' && (
                           <button 
                             onClick={() => markComplete(s.id)}
                             className="flex items-center gap-1 text-sm bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium border border-primary/20"
                           >
                             <Package className="w-4 h-4" /> Mark Picked Up
                           </button>
                         )}

                         {s.status === 'completed' && (
                           <button 
                             onClick={() => downloadReport(s)}
                             className="flex items-center gap-1 text-sm bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium border border-primary/20"
                           >
                             <FileDown className="w-4 h-4" /> Download Report
                           </button>
                         )}
                       </div>
                     </div>

                     {/* Handover Traceability Section */}
                     {(s.status === 'approved' || s.status === 'on_the_way' || s.status === 'handover_pending' || s.status === 'completed') && (
                        <div className="mt-4 pt-4 border-t border-border/20 grid md:grid-cols-2 gap-6">
                           {/* Transfer Code */}
                           {(s.status === 'approved' || s.status === 'on_the_way' || s.status === 'handover_pending') && (
                             <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col items-center justify-center text-center">
                               <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2 flex items-center gap-2">
                                 <ShieldCheck className="w-3 h-3" /> Digital Handover Code
                               </div>
                               <div className="text-4xl font-mono font-black tracking-[0.2em] text-primary mb-1">{s.pickupCode}</div>
                               <p className="text-[10px] text-muted-foreground leading-relaxed">
                                 Ask the NGO driver to enter this code on their device to verify the secure transfer of food responsibility.
                               </p>
                             </div>
                           )}

                           {/* Timeline */}
                           <div className={s.status === 'completed' ? "md:col-span-2" : ""}>
                             <HandoverTimeline logs={s.logs || []} />
                           </div>
                        </div>
                     )}
                   </div>
                 )
              })}
              </div>
            )}
          </motion.div>
        )}

        {/* Analytics */}
        {tab === 'analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Food Saved (Completed)', value: `${surplus.filter(s=>s.status==='completed').reduce((sum,s)=>sum+s.quantity,0)} kg` },
                { label: 'Meals Provided', value: metrics.mealsRedistributed },
                { label: 'Waste Reduction', value: `${metrics.wasteReduction}%` },
                { label: 'Prediction Logs', value: logs.length },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </div>
              ))}
            </div>
            {chartData.length > 1 && (
              <>
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-4">Prepared vs Consumed Trends</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                      <Bar dataKey="prepared" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consumed" fill="hsl(140, 6%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Recommendations */}
        {tab === 'recommendations' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Lightbulb className="w-6 h-6 text-secondary" /> AI Smart Tips</h2>
            {recs.map((r, i) => (
              <div key={i} className="glass-card p-5 flex items-start gap-4 hover:border-primary/30 transition-all">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4 text-secondary" />
                </div>
                <p className="text-sm leading-relaxed">{r}</p>
              </div>
            ))}
          </motion.div>
        )}
        
        {/* Predictions Tab Leftovers */}
        {tab === 'predictions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-6 glow-border">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Footfall Prediction</h3>
                <div className="text-5xl font-bold text-primary mb-2">{prediction.predicted}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {trendIcon} Trend: <span className="capitalize">{prediction.trend}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Derived purely from the Daily Log footfall data.</p>
              </div>
              <div className="glass-card p-6 glow-border">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Recommended Prep</h3>
                <div className="text-5xl font-bold text-primary mb-2">{predictedFood} <span className="text-lg">kg</span></div>
                <p className="text-xs text-muted-foreground mt-3">Calculated from AI footfall model.</p>
              </div>
            </div>
            {chartData.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Daily Logs Target vs Actual</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="footfall" stroke="hsl(145, 65%, 42%)" strokeWidth={2} dot={{ fill: 'hsl(145, 65%, 42%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}
        {/* Full Map View */}
        {tab === 'map' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><MapPin className="w-6 h-6 text-primary" /> Real-time Logistics Map</h2>
            <p className="text-sm text-muted-foreground mb-4">Visualize all your active surplus listings across the region.</p>
            <MapView items={surplus} />
          </motion.div>
        )}
        {/* Messages */}
        {tab === 'messages' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ChatInterface currentUser={user} />
          </motion.div>
        )}
        {/* Quality Check AI */}
        {tab === 'quality-check' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <QualityCheckAI />
          </motion.div>
        )}
        </div>
      </main>
    </div>
  );
}

// Sub-component for Lifecycle Timeline
function HandoverTimeline({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return null;

  const getLogLabel = (action: string) => {
    switch (action) {
      case 'available': return 'Food Posted';
      case 'requested': return 'Requested by NGO';
      case 'approved': return 'Approved for Pickup';
      case 'pickup_started': return 'NGO En Route';
      case 'handover_accepted': return 'Digital Handshake';
      case 'completed': return 'Redistribution Complete';
      default: return (action as string).replace('_', ' ');
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/50 pb-2 flex items-center gap-2">
        <Clock className="w-3 h-3" /> Traceability Audit Log
      </div>
      <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted/50">
        {logs.map((log: any, i: number) => (
          <div key={i} className="flex gap-4 relative">
            <div className={`w-4 h-4 rounded-full border-2 border-background z-10 ${i === logs.length - 1 ? 'bg-primary ring-4 ring-primary/20 animate-pulse' : 'bg-muted'}`}></div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${i === logs.length - 1 ? 'text-primary' : 'text-foreground'}`}>{getLogLabel(log.action)}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[10px] text-muted-foreground italic">By {log.actor}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
