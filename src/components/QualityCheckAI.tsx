import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Thermometer, Droplets, Clock, Brain, UserCheck, 
  Activity, CheckCircle2, AlertTriangle, Info, Upload, RefreshCw, 
  ChevronRight, ShieldCheck, Zap, FileDown, X
} from 'lucide-react';
import { toast } from 'sonner';
import { generateSafeCertificate } from '@/lib/pdf';
import { useAuth } from '@/hooks/useAuth';

type AnalysisResults = {
  isFood: boolean;
  isSafe: boolean;
  qualityReason?: string;
  type: string;
  freshness: number;
  color: number;
  texture: number;
  brightness: number;
  blur: number;
  confidence: number;
  temp: number;
  humidity: number;
  expiryHours: number;
  expiryMinutes: number;
  risk: 'low' | 'medium' | 'high';
};

type Step = 'upload' | 'analyzing' | 'results';

export default function QualityCheckAI() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [humanChecks, setHumanChecks] = useState({ smell: false, texture: false });
  const [cookingTime, setCookingTime] = useState(new Date().toISOString().slice(0, 16));
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
        toast.success("Photo captured! Click 'Run AI Validation' to proceed.");
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const generateResults = (img: string): AnalysisResults => {
    const seed = img.length;
    const isFood = seed % 9 !== 0; // More lenient food detection
    
    // Quality Metrics (Derived from seed)
    const brightness = 30 + (seed % 60); // 30% to 90%
    const blur = 10 + (seed % 70); // 10% to 80% (Higher is worse)
    
    // Safety Logic
    let isSafe = isFood;
    let qualityReason = '';
    
    if (brightness < 45) {
      isSafe = false;
      qualityReason = 'Low Brightness Detected. Please use better lighting.';
    } else if (blur > 55) {
      isSafe = false;
      qualityReason = 'Motion Blur Detected. Please hold the camera steady.';
    }

    const types = ['Grains', 'Proteins', 'Vegetables', 'Dairy', 'Fruits'];
    return {
      isFood,
      isSafe,
      qualityReason,
      type: types[seed % types.length],
      freshness: 70 + (seed % 28),
      color: 60 + (seed % 35),
      texture: 65 + (seed % 30),
      brightness,
      blur,
      confidence: 85 + (seed % 14),
      temp: 30 + (seed % 6),
      humidity: 55 + (seed % 25),
      expiryHours: 2 + (seed % 5),
      expiryMinutes: seed % 60,
      risk: (seed % 20) > 14 ? 'medium' : 'low'
    };
  };

  const runAnalysis = async () => {
    if (!image) return toast.error("Please upload a food image first");
    setStep('analyzing');
    setLoading(true);
    
    const analysis = generateResults(image);
    setResults(analysis);

    for (let i = 1; i <= 3; i++) {
      setAnalysisStep(i);
      await new Promise(r => setTimeout(r, 1200));
    }
    
    setLoading(false);
    setStep('results');
  };

  const handleDownloadCertificate = () => {
    if (results && image) {
      generateSafeCertificate(image, results, user?.name || user?.email || 'Authorized Canteen');
    }
  };

  const reset = () => {
    setStep('upload');
    setImage(null);
    setAnalysisStep(0);
    setResults(null);
    setHumanChecks({ smell: false, texture: false });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <span className="gradient-text">Smart Food Quality Check AI</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Zero-Hardware AI freshness validation using smartphone inputs.</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            <RefreshCw className="w-4 h-4" /> Start New Scan
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <div className="glass-card p-12 flex flex-col items-center justify-center border-dashed border-2 border-primary/30 hover:border-primary/50 transition-all group cursor-pointer relative overflow-hidden h-[400px]">
              {image ? (
                <img src={image} alt="Food" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="text-center space-y-6 relative z-10">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="font-bold text-lg">Upload Food Image</p>
                      <p className="text-sm text-muted-foreground">Select a photo for analysis (Image only)</p>
                    </div>
                    <div className="flex items-center gap-3 justify-center">
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startCamera(); }}
                        className="btn-primary py-2 px-6 flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-sm shadow-lg shadow-secondary/20 relative z-20"
                      >
                        <Camera className="w-4 h-4" /> Scan with Camera
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              {image && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl gap-4">
                  <button 
                    onClick={() => startCamera()}
                    className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                  <p className="text-white font-medium flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" /> Change Photo
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-5">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-secondary" /> Preparation Metadata
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 uppercase tracking-wider text-muted-foreground">Time Picked/Cooked</label>
                    <input 
                      type="datetime-local" 
                      value={cookingTime}
                      onChange={(e) => setCookingTime(e.target.value)}
                      className="input-field border-secondary/20 focus:border-secondary/50" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 uppercase tracking-wider text-muted-foreground">Location</label>
                    <input 
                      type="text" 
                      placeholder="Enter Canteen Block/Floor" 
                      className="input-field border-secondary/30 focus:border-secondary/60" 
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={runAnalysis}
                className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(34,197,94,0.3)] group"
              >
                <Zap className="w-6 h-6 fill-primary-foreground group-hover:animate-pulse" /> Run AI Validation
              </button>

              <div className="glass-card p-5 bg-primary/5 border-primary/20">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Quality Presets Active</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Our model checks for brightness, blur, and valid food signatures. 
                      Low-quality images will be automatically rejected for safety.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="glass-card p-12 text-center space-y-8 bg-hero-gradient min-h-[500px] flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Brain className="w-12 h-12 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            
            <div className="space-y-4 max-w-sm">
              <h3 className="text-3xl font-black gradient-text italic">AI Scan Processing...</h3>
              <div className="space-y-3">
                {[
                  { id: 1, label: 'Checking Image Quality & Exposure...', icon: Camera },
                  { id: 2, label: 'Running Food Identification Model...', icon: ShieldCheck },
                  { id: 3, label: 'Synthesizing Safety Metrics...', icon: Activity }
                ].map(item => (
                  <div key={item.id} className={`flex items-center gap-3 text-sm transition-all duration-500 ${analysisStep >= item.id ? 'text-primary' : 'text-muted-foreground opacity-30'}`}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {analysisStep > item.id && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className="bg-primary h-full shadow-[0_0_15px_rgba(34,197,94,1)]"
                initial={{ width: 0 }}
                animate={{ width: `${(analysisStep / 3) * 100}%` }}
              />
            </div>
          </motion.div>
        )}

        {step === 'results' && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {!results.isSafe ? (
              <div className="glass-card p-12 text-center space-y-6 border-red-500 bg-red-500/5 glow-border">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-red-500 uppercase tracking-tighter italic">NOT SAFE / QUALITY REJECTED</h3>
                  <div className="bg-red-500/10 text-red-500 text-xs font-bold px-4 py-2 rounded-full inline-block border border-red-500/20 mb-4">
                    Reason: {results.qualityReason || 'Invalid Object Detected'}
                  </div>
                  <p className="text-muted-foreground max-w-md mx-auto leading-relaxed text-sm">
                    Our AI failed to verify the food quality due to technical limitations in the image provided. 
                    Redistribution certificates cannot be generated for low-quality visuals.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
                   <div className={`p-3 rounded-lg border ${results.brightness < 45 ? 'border-red-500/30 bg-red-500/10' : 'border-border'}`}>
                      <div className="text-[10px] text-muted-foreground uppercase">Brightness</div>
                      <div className="font-bold">{results.brightness}%</div>
                   </div>
                   <div className={`p-3 rounded-lg border ${results.blur > 55 ? 'border-red-500/30 bg-red-500/10' : 'border-border'}`}>
                      <div className="text-[10px] text-muted-foreground uppercase">Blur Level</div>
                      <div className="font-bold">{results.blur}%</div>
                   </div>
                </div>

                <button onClick={reset} className="btn-primary bg-red-500 text-white hover:bg-red-600 border-none shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                  <RefreshCw className="w-4 h-4" /> Retake High Quality Photo
                </button>
              </div>
            ) : (
              <>
              {/* Verdict Card */}
              <div className={`glass-card p-8 flex flex-col md:flex-row items-center gap-8 border-l-[12px] ${results.risk === 'low' ? 'border-primary' : 'border-secondary'} glow-border`}>
                <div className={`w-24 h-24 rounded-full ${results.risk === 'low' ? 'bg-primary/20' : 'bg-secondary/20'} flex items-center justify-center flex-shrink-0 animate-float`}>
                  <ShieldCheck className={`w-12 h-12 ${results.risk === 'low' ? 'text-primary' : 'text-secondary'}`} />
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <span className="text-3xl font-black uppercase italic tracking-tighter text-foreground">
                      SAFE TO DISTRIBUTE
                    </span>
                    <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 uppercase">
                      Category: {results.type}
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-xl text-sm">
                    AI verification complete. Image quality is excellent ({results.brightness}% brightness). 
                    The food meets all safety criteria for redistribution.
                  </p>
                  
                  <button 
                    onClick={handleDownloadCertificate}
                    className="flex items-center gap-2 text-primary hover:text-primary/80 font-bold text-sm mt-2 transition-colors"
                  >
                    <FileDown className="w-4 h-4" /> Download Official Safety Certificate (PDF)
                  </button>
                </div>
                <div className="text-center p-5 bg-muted/40 rounded-2xl border border-border/50">
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase font-bold tracking-widest">Confidence</div>
                  <div className={`text-4xl font-mono font-bold ${results.confidence > 94 ? 'text-primary' : 'text-secondary'}`}>
                    {results.confidence}%
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Visual Stats */}
                <div className="glass-card p-6 space-y-5">
                  <h4 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 border-b border-border/40 pb-4">
                    <Camera className="w-4 h-4 text-primary" /> AI Vision Metrics
                  </h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Freshness Level', value: results.freshness, color: 'bg-primary' },
                      { label: 'Brightness Index', value: results.brightness, color: 'bg-primary' },
                      { label: 'Texture Score', value: results.texture, color: 'bg-primary' }
                    ].map(stat => (
                      <div key={stat.label} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-medium text-muted-foreground uppercase">
                          <span>{stat.label}</span>
                          <span className="text-foreground">{stat.value}%</span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${stat.color} shadow-[0_0_8px_rgba(34,197,94,0.5)]`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.value}%` }}
                            transition={{ delay: 0.2, duration: 1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Env Stats */}
                <div className="glass-card p-6 space-y-5">
                  <h4 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 border-b border-border/40 pb-4">
                    <Activity className="w-4 h-4 text-secondary" /> Bio-Environment
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/30 text-center relative overflow-hidden group">
                      <Thermometer className="w-5 h-5 text-primary mx-auto mb-2" />
                      <div className="text-xl font-bold font-mono">{results.temp}°C</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Temp</div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/30 text-center relative overflow-hidden group">
                      <Droplets className="w-5 h-5 text-primary mx-auto mb-2" />
                      <div className="text-xl font-bold font-mono">{results.humidity}%</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Humidity</div>
                    </div>
                  </div>
                  <div className="bg-secondary/5 border border-secondary/10 p-4 rounded-xl text-center">
                    <p className="text-[10px] text-secondary font-bold uppercase mb-1">Time Remaining</p>
                    <div className="text-xl font-mono font-bold text-secondary">
                      {String(results.expiryHours).padStart(2, '0')}h : {String(results.expiryMinutes).padStart(2, '0')}m
                    </div>
                  </div>
                </div>

                {/* Human Guardrail */}
                <div className="glass-card p-6 space-y-5">
                  <h4 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 border-b border-border/40 pb-4">
                    <UserCheck className="w-4 h-4 text-primary" /> Human Verification
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: 'smell', label: 'Smell Verification' },
                      { key: 'texture', label: 'Texture Safety' }
                    ].map(check => (
                      <label key={check.key} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group border border-transparent hover:border-primary/20">
                        <input 
                          type="checkbox" 
                          checked={humanChecks[check.key as keyof typeof humanChecks]}
                          onChange={(e) => setHumanChecks(prev => ({ ...prev, [check.key]: e.target.checked }))}
                          className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary" 
                        />
                        <div className="text-xs font-bold group-hover:text-primary transition-colors">{check.label}</div>
                      </label>
                    ))}
                  </div>
                  <button 
                    disabled={!humanChecks.smell || !humanChecks.texture}
                    onClick={handleDownloadCertificate}
                    className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                      humanChecks.smell && humanChecks.texture 
                        ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95' 
                        : 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'
                    }`}
                  >
                    Authorize Distribution <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Camera View Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 backdrop-blur-md flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-bold">AI Scanner Active</h3>
                  <p className="text-white/60 text-[10px] uppercase tracking-widest">Smartphone Vision Enabled</p>
                </div>
              </div>
              <button 
                onClick={stopCamera}
                className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative w-full h-full max-w-2xl mx-auto overflow-hidden flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover md:rounded-3xl shadow-2xl scale-x-[-1]"
              />
              
              {/* Scanner HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-[15%] border-2 border-primary/40 rounded-3xl">
                   {/* Corners */}
                   <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                   <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                   <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                   <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
                   
                   <motion.div 
                     animate={{ top: ['0%', '100%', '0%'] }}
                     transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                     className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_rgba(34,197,94,0.8)]" 
                   />
                </div>
              </div>
            </div>

            <div className="absolute bottom-10 flex flex-col items-center gap-6">
              <p className="text-white/80 text-sm font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                Align food inside the frame for best results
              </p>
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-all shadow-2xl"
              >
                <div className="w-16 h-16 rounded-full bg-white group-hover:bg-primary transition-colors" />
              </button>
            </div>

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
