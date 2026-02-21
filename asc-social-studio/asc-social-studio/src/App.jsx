import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Type, Image as ImageIcon, Download, LayoutTemplate, Trash2, 
  Save, MousePointer2, Layers, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, BringToFront, SendToBack, Monitor, FolderOpen, 
  Grid, Briefcase, Quote, PlusCircle, LogOut, Loader2, Sparkles, Wand2
} from 'lucide-react';

// ==========================================
// 1. CONFIGURAÇÃO FIREBASE E GEMINI
// ==========================================
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, 
  onAuthStateChanged, signInAnonymously, signInWithCustomToken 
} from "firebase/auth";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCBQUN5nlvlol_fAxja1-O21gprQZNCkVM",
  authDomain: "audit-educa-system.firebaseapp.com",
  projectId: "audit-educa-system",
  storageBucket: "audit-educa-system.firebasestorage.app",
  messagingSenderId: "491204425302",
  appId: "1:491204425302:web:3b0edcc719a1110640adf7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ATENÇÃO: Substitua pela sua chave API do Google AI Studio quando usar localmente
const GEMINI_API_KEY = "SUA_CHAVE_GEMINI_AQUI"; 

// ==========================================
// CONSTANTES DA MARCA ASC
// ==========================================
const PRESETS = {
  'linkedin-post': { width: 1080, height: 1080, name: 'LinkedIn Post (Feed)' },
  'linkedin-banner': { width: 1584, height: 396, name: 'LinkedIn Banner' },
  'ig-story': { width: 1080, height: 1920, name: 'Instagram Story' },
};
const BRAND_COLORS = ['#0a1f44', '#1e3a8a', '#64748b', '#f8fafc', '#ffffff', '#e11d48'];
const FONTS = ['Helvetica', 'Arial', 'Times New Roman', 'Courier New', 'Georgia'];
const CORPORATE_ASSETS = [
  { id: 1, url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&q=80', label: 'Escritório' },
  { id: 2, url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&q=80', label: 'Reunião' },
  { id: 3, url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80', label: 'Equipa' },
];

export default function App() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  
  // Estados de Autenticação
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Estados do Canvas
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, setUiTrigger] = useState(0); 
  
  // Estados de Projetos
  const [isSaving, setIsSaving] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState({ id: null, name: 'Novo Design ASC' });

  // Estados de Uploads (Storage)
  const [userUploads, setUserUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Estados de UI
  const [activeTab, setActiveTab] = useState('templates');
  const [activeObject, setActiveObject] = useState(null);
  const [scale, setScale] = useState(1);
  const [currentPreset, setCurrentPreset] = useState('linkedin-post');

  // Estados da IA Gemini
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // ==========================================
  // LÓGICA DE AUTENTICAÇÃO
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Bloqueio de segurança. Adicione o seu domínio atual aos domínios autorizados do Firebase Console > Authentication > Settings.");
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (e) { console.warn("Fallback anónimo falhou."); }
      } else {
        setLoginError(`Falha na autenticação: ${error.message}`);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  // ==========================================
  // INICIALIZAÇÃO DO MOTOR GRÁFICO (Fabric.js)
  // ==========================================
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src; script.async = true;
        script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    ]).then(() => { 
      if (isMounted) setIsLoaded(true); 
    }).catch(err => console.error("Erro ao carregar motor", err));

    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!isLoaded || !canvasRef.current || !user) return;
    
    const { width, height } = PRESETS[currentPreset];
    const canvas = new window.fabric.Canvas(canvasRef.current, { 
      width, height, 
      backgroundColor: '#f8fafc', 
      preserveObjectStacking: true 
    });
    
    setFabricCanvas(canvas);

    const handleSelection = (e) => { 
      setActiveObject(e.selected ? e.selected[0] : null); 
      setUiTrigger(prev => prev + 1); 
    };
    
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => { setActiveObject(null); setUiTrigger(prev => prev + 1); });
    canvas.on('object:modified', () => setUiTrigger(prev => prev + 1));

    return () => { try { canvas.dispose(); } catch (err) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  useEffect(() => {
    if (fabricCanvas) {
      const { width, height } = PRESETS[currentPreset];
      fabricCanvas.setWidth(width); 
      fabricCanvas.setHeight(height);
      fabricCanvas.renderAll(); 
      updateScale();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPreset, fabricCanvas]);

  const updateScale = useCallback(() => {
    if (!wrapperRef.current || !fabricCanvas) return;
    const { width: wrapperWidth, height: wrapperHeight } = wrapperRef.current.getBoundingClientRect();
    const { width: canvasWidth, height: canvasHeight } = PRESETS[currentPreset];
    const padding = 60;
    const scaleX = (wrapperWidth - padding) / canvasWidth;
    const scaleY = (wrapperHeight - padding) / canvasHeight;
    setScale(Math.min(scaleX, scaleY, 1));
  }, [currentPreset, fabricCanvas]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // ==========================================
  // LÓGICA DE NUVEM (Firestore & Storage)
  // ==========================================
  useEffect(() => {
    if (!user) return;
    
    // 1. Ouvinte de Projetos
    const projectsRef = collection(db, "users", user.uid, "projects");
    const unsubscribeProjects = onSnapshot(projectsRef, (snapshot) => {
      const projs = [];
      snapshot.forEach((doc) => projs.push({ id: doc.id, ...doc.data() }));
      projs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setSavedProjects(projs);
    }, (error) => console.error("Erro projetos:", error));

    // 2. Ouvinte de Uploads (Galeria Pessoal)
    const uploadsRef = collection(db, "users", user.uid, "uploads");
    const unsubscribeUploads = onSnapshot(uploadsRef, (snapshot) => {
      const uploads = [];
      snapshot.forEach((doc) => uploads.push({ id: doc.id, ...doc.data() }));
      uploads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUserUploads(uploads);
    }, (error) => console.error("Erro uploads:", error));

    return () => {
      unsubscribeProjects();
      unsubscribeUploads();
    };
  }, [user]);

  const saveProject = async () => {
    if (!fabricCanvas || !user) return;
    setIsSaving(true);
    
    const id = currentProject.id || `proj_${Date.now()}`;
    const name = currentProject.id ? currentProject.name : prompt("Nome do Projeto:", "Novo Design ASC") || "Novo Design ASC";
    
    const projectData = { 
      name, 
      date: new Date().toISOString(), 
      preset: currentPreset, 
      canvasData: JSON.stringify(fabricCanvas.toJSON()) 
    };

    try {
      await setDoc(doc(db, "users", user.uid, "projects", id), projectData);
      setCurrentProject({ id, name }); 
      setActiveTab('projects');
    } catch (error) { 
      console.error("Erro a guardar:", error); 
      alert("Erro ao guardar o projeto na nuvem. Verifique permissões."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const loadProject = (projectObj) => {
    if (!fabricCanvas) return;
    setCurrentPreset(projectObj.preset || 'linkedin-post');
    setCurrentProject({ id: projectObj.id, name: projectObj.name });
    setTimeout(() => {
      try {
        const parsedData = JSON.parse(projectObj.canvasData);
        fabricCanvas.loadFromJSON(parsedData, () => { 
          fabricCanvas.renderAll(); 
          setUiTrigger(prev => prev + 1); 
        });
      } catch (err) { console.error("Erro a renderizar", err); }
    }, 100);
  };

  const deleteProject = async (id, e) => {
    e.stopPropagation();
    if(window.confirm("Tem a certeza que deseja eliminar este projeto da Nuvem?")) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "projects", id));
        if (currentProject.id === id) startNewProject();
      } catch (error) { console.error(error); }
    }
  };

  const startNewProject = () => {
    setCurrentProject({ id: null, name: 'Novo Design ASC' });
    if (fabricCanvas) { 
      fabricCanvas.clear(); 
      fabricCanvas.setBackgroundColor('#f8fafc', fabricCanvas.renderAll.bind(fabricCanvas)); 
    }
    setActiveTab('templates');
  };

  const handleLocalImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !fabricCanvas || !user) return;

    setIsUploading(true);

    try {
      const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        null, 
        (error) => {
          console.error("Erro no upload Storage:", error);
          setIsUploading(false);
          alert("Erro ao carregar a imagem para a nuvem.");
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "users", user.uid, "uploads"), {
            url: downloadURL,
            name: file.name,
            createdAt: new Date().toISOString()
          });
          addImageFromUrl(downloadURL);
          setIsUploading(false);
        }
      );
    } catch (error) {
      console.error("Erro geral no upload:", error);
      setIsUploading(false);
    }
    
    e.target.value = null; // Limpa o input
  };

  // ==========================================
  // LÓGICA DA INTELIGÊNCIA ARTIFICIAL (GEMINI)
  // ==========================================
  const generateWithGemini = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    
    const apiKey = GEMINI_API_KEY === "SUA_CHAVE_GEMINI_AQUI" ? "" : GEMINI_API_KEY;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          systemInstruction: { 
            parts: [{ 
              text: "És um assistente de marketing da consultora 'ASC Consulting'. Ajuda a criar textos curtos e impactantes para imagens no LinkedIn/Instagram sobre governança, ESG e auditoria. Devolve apenas o texto, sem aspas e sem tags markdown." 
            }] 
          }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      setAiResult(text ? text.trim() : "Não foi possível gerar uma resposta. Tente novamente.");
    } catch (error) {
      console.error("Erro na API do Gemini:", error);
      setAiResult("Erro ao contactar a IA. Verifique a sua Chave de API.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const addAiTextToCanvas = () => {
    if (!fabricCanvas || !aiResult) return;
    
    const textbox = new window.fabric.Textbox(aiResult, {
      left: 100, top: 100, 
      width: PRESETS[currentPreset].width - 200, 
      fontFamily: 'Helvetica', 
      fill: '#0a1f44', 
      fontSize: 48,
      fontWeight: 'bold',
      lineHeight: 1.3
    });
    
    fabricCanvas.add(textbox); 
    fabricCanvas.setActiveObject(textbox); 
    fabricCanvas.renderAll();
    setUiTrigger(prev => prev + 1);
  };

  // ==========================================
  // FERRAMENTAS DO CANVAS E EXPORTAÇÃO
  // ==========================================
  const addText = () => {
    if (!fabricCanvas) return;
    const text = new window.fabric.IText('Insira o seu título', { left: 100, top: 100, fontFamily: 'Helvetica', fill: '#0a1f44', fontSize: 60, fontWeight: 'bold' });
    fabricCanvas.add(text); fabricCanvas.setActiveObject(text); fabricCanvas.renderAll();
  };

  const addShape = (type = 'rect') => {
    if (!fabricCanvas) return;
    let shape = type === 'rect' ? new window.fabric.Rect({ left: 100, top: 100, fill: '#1e3a8a', width: 300, height: 100, rx: 8, ry: 8 }) : new window.fabric.Circle({ left: 100, top: 100, fill: '#e11d48', radius: 100 });
    fabricCanvas.add(shape); fabricCanvas.setActiveObject(shape); fabricCanvas.renderAll();
  };

  const addImageFromUrl = (url) => {
    if (!fabricCanvas) return;
    window.fabric.Image.fromURL(url, (img) => {
      const scaleToFit = Math.min((fabricCanvas.width * 0.8) / img.width, (fabricCanvas.height * 0.8) / img.height);
      img.scale(scaleToFit); img.set({ left: 50, top: 50 });
      fabricCanvas.add(img); fabricCanvas.setActiveObject(img); fabricCanvas.renderAll();
    }, { crossOrigin: 'anonymous' });
  };

  const applyTemplate = (type) => {
    if (!fabricCanvas) return;
    fabricCanvas.clear(); setCurrentPreset('linkedin-post');
    if (type === 'vaga') {
      fabricCanvas.setBackgroundColor('#f8fafc', fabricCanvas.renderAll.bind(fabricCanvas));
      const header = new window.fabric.Rect({ left: 0, top: 0, width: 1080, height: 250, fill: '#0a1f44' });
      const tagText = new window.fabric.IText('ESTAMOS A CONTRATAR', { left: 80, top: 90, fontFamily: 'Helvetica', fill: '#64748b', fontSize: 32, fontWeight: 'bold', tracking: 200 });
      const roleText = new window.fabric.IText('Consultor Sénior', { left: 80, top: 140, fontFamily: 'Helvetica', fill: '#ffffff', fontSize: 64, fontWeight: 'bold' });
      const bodyText = new window.fabric.IText('Junte-se à equipa da ASC Consulting e\ntransforme desafios em resultados.', { left: 80, top: 400, fontFamily: 'Helvetica', fill: '#1e3a8a', fontSize: 42, lineHeight: 1.4 });
      const btn = new window.fabric.Rect({ left: 80, top: 800, width: 350, height: 90, fill: '#e11d48', rx: 45, ry: 45 });
      const btnText = new window.fabric.IText('Candidatar-me', { left: 130, top: 825, fontFamily: 'Helvetica', fill: '#ffffff', fontSize: 32, fontWeight: 'bold' });
      fabricCanvas.add(header, tagText, roleText, bodyText, btn, btnText);
    } 
    fabricCanvas.renderAll(); setCurrentProject({ id: null, name: `Novo Design (${type})` });
  };

  const updateActiveObjectProperty = (property, value) => {
    if (!activeObject || !fabricCanvas) return;
    activeObject.set(property, value); fabricCanvas.renderAll(); setUiTrigger(prev => prev + 1);
  };

  const deleteActiveObject = () => {
    if (!activeObject || !fabricCanvas) return;
    fabricCanvas.remove(activeObject); fabricCanvas.discardActiveObject(); fabricCanvas.renderAll(); setActiveObject(null);
  };

  const exportAsset = (format = 'png') => {
    if (!fabricCanvas) return;
    fabricCanvas.discardActiveObject(); fabricCanvas.renderAll();
    const fileName = `ASC_${currentProject.name.replace(/\s+/g, '_')}_${Date.now()}`;
    
    if (format === 'pdf') {
      const dataURL = fabricCanvas.toDataURL({ format: 'jpeg', quality: 0.9 });
      const { jsPDF } = window.jspdf;
      const { width, height } = PRESETS[currentPreset];
      const orientation = width > height ? 'l' : 'p';
      const doc = new jsPDF({ orientation, unit: 'px', format: [width, height] });
      doc.addImage(dataURL, 'JPEG', 0, 0, width, height); 
      doc.save(`${fileName}.pdf`);
    } else {
      const dataURL = fabricCanvas.toDataURL({ format: format, quality: 1, multiplier: 2 });
      const link = document.createElement('a'); 
      link.download = `${fileName}.${format}`;
      link.href = dataURL; 
      link.click();
    }
  };

  // ==========================================
  // RENDERIZAÇÃO CONDICIONAL (UI)
  // ==========================================
  if (authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 size={48} className="animate-spin text-[#1e3a8a]" /></div>;

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] font-sans px-4">
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#0a1f44] text-white rounded-xl flex items-center justify-center mb-6 shadow-md"><Layers size={32} /></div>
          <h1 className="text-2xl font-bold text-[#0a1f44] mb-2">ASC Social Studio</h1>
          <p className="text-gray-500 text-sm mb-8">Ferramenta com Inteligência Artificial e Firebase para design corporativo. Faça login.</p>
          <button onClick={handleLogin} className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-gray-200 hover:border-[#1e3a8a] text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>Entrar com Conta Google</span>
          </button>
          {loginError && <div className="mt-5 p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg text-left"><strong>Aviso:</strong> {loginError}</div>}
        </div>
      </div>
    );
  }

  if (!isLoaded) return <div className="flex h-screen items-center justify-center bg-gray-50"><Layers size={48} className="animate-pulse text-[#1e3a8a] mb-4" /></div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-800">
      
      {/* HEADER PRINCIPAL */}
      <header className="h-16 bg-[#0a1f44] text-white flex items-center justify-between px-6 shadow-md z-10 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 border-r border-blue-800 pr-4">
            <Layers className="text-blue-300" size={24} />
            <h1 className="text-lg font-bold tracking-wide hidden sm:block">ASC <span className="font-light">Social Studio</span></h1>
          </div>
          <div className="text-sm font-medium bg-blue-900/50 px-3 py-1 rounded truncate max-w-[150px] md:max-w-none">{currentProject.name}</div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button onClick={startNewProject} className="flex items-center space-x-1 hover:bg-[#1e3a8a] px-3 py-1.5 rounded transition text-blue-200 hover:text-white"><PlusCircle size={16} /> <span className="text-sm font-medium hidden md:inline">Novo</span></button>
          <button onClick={saveProject} disabled={isSaving} className={`flex items-center space-x-1 hover:bg-[#1e3a8a] px-3 py-1.5 rounded transition ${isSaving ? 'opacity-50' : ''}`}>{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}<span className="text-sm font-medium">{isSaving ? 'A guardar...' : 'Guardar'}</span></button>
          
          <div className="relative group">
            <button className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded transition shadow-sm"><Download size={16} /> <span className="text-sm font-medium hidden md:inline">Exportar</span></button>
            <div className="absolute right-0 mt-2 w-36 bg-white rounded shadow-lg overflow-hidden hidden group-hover:block text-gray-800 border border-gray-100">
              <button onClick={() => exportAsset('png')} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm">PNG (Alta Qualidade)</button>
              <button onClick={() => exportAsset('jpeg')} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm">JPG (Padrão)</button>
              <button onClick={() => exportAsset('pdf')} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm">Documento PDF</button>
            </div>
          </div>
          <button onClick={handleLogout} className="ml-2 text-blue-300 hover:text-red-400 p-2"><LogOut size={18} /></button>
        </div>
      </header>

      {/* CORPO DO APLICATIVO */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        
        {/* BARRA LATERAL ESQUERDA */}
        <aside className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20">
          <div className="flex border-b text-[10px] md:text-xs font-medium text-gray-500 overflow-x-auto">
            <button onClick={() => setActiveTab('templates')} className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 transition ${activeTab === 'templates' ? 'border-b-2 border-[#0a1f44] text-[#0a1f44]' : 'hover:bg-gray-50'}`}><LayoutTemplate size={16} /> Templates</button>
            <button onClick={() => setActiveTab('tools')} className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 transition ${activeTab === 'tools' ? 'border-b-2 border-[#0a1f44] text-[#0a1f44]' : 'hover:bg-gray-50'}`}><Type size={16} /> Elementos</button>
            <button onClick={() => setActiveTab('assets')} className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 transition ${activeTab === 'assets' ? 'border-b-2 border-[#0a1f44] text-[#0a1f44]' : 'hover:bg-gray-50'}`}><Grid size={16} /> Imagens</button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 transition ${activeTab === 'ai' ? 'border-b-2 border-purple-600 text-purple-700 bg-purple-50' : 'hover:bg-gray-50 text-purple-600'}`}><Sparkles size={16} /> Assistente</button>
            <button onClick={() => setActiveTab('projects')} className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 transition ${activeTab === 'projects' ? 'border-b-2 border-[#0a1f44] text-[#0a1f44]' : 'hover:bg-gray-50'}`}><FolderOpen size={16} /> Nuvem</button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto bg-gray-50/50">
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tamanhos (Em Branco)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PRESETS).map(([key, data]) => (
                      <button key={key} onClick={() => { setCurrentPreset(key); fabricCanvas.clear(); }} className={`p-3 rounded-lg border text-left transition flex flex-col items-center justify-center text-center gap-2 ${currentPreset === key ? 'border-[#0a1f44] bg-blue-50 text-[#0a1f44] shadow-sm' : 'border-gray-200 hover:border-blue-300 bg-white'}`}><Monitor size={20} className={currentPreset === key ? 'text-[#1e3a8a]' : 'text-gray-400'} /><div><p className="font-semibold text-xs leading-tight">{data.name}</p></div></button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Padrões ASC</h3>
                  <div className="space-y-3">
                    <button onClick={() => applyTemplate('vaga')} className="w-full bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 hover:border-[#1e3a8a] hover:shadow-sm transition group"><div className="bg-blue-100 text-[#1e3a8a] p-2 rounded group-hover:bg-[#1e3a8a] group-hover:text-white transition"><Briefcase size={20}/></div><div className="text-left"><p className="font-bold text-sm text-gray-800">Vaga de Emprego</p><p className="text-xs text-gray-500">Postagem Quadrada</p></div></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-4">
                <button onClick={addText} className="w-full flex items-center space-x-3 bg-white hover:bg-blue-50 border border-gray-200 p-4 rounded-lg transition shadow-sm"><div className="bg-blue-100 p-2 rounded text-[#0a1f44]"><Type size={18}/></div><span className="text-sm font-bold text-gray-700">Adicionar Texto</span></button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => addShape('rect')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-[#1e3a8a] transition shadow-sm gap-2"><div className="w-8 h-6 bg-[#1e3a8a] rounded-sm"></div><span className="text-xs font-semibold text-gray-600">Retângulo</span></button>
                  <button onClick={() => addShape('circle')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-lg hover:border-[#1e3a8a] transition shadow-sm gap-2"><div className="w-7 h-7 bg-[#e11d48] rounded-full"></div><span className="text-xs font-semibold text-gray-600">Círculo</span></button>
                </div>
              </div>
            )}

            {activeTab === 'assets' && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                  <label className={`w-full flex items-center justify-center space-x-2 bg-[#0a1f44] hover:bg-[#1e3a8a] text-white p-3 rounded-lg transition cursor-pointer shadow-md ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                    <span className="text-sm font-bold">{isUploading ? 'A carregar...' : 'Fazer Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleLocalImageUpload} className="hidden" disabled={isUploading} />
                  </label>
                  <p className="text-center text-[10px] text-gray-400 mt-2">Guarda automaticamente no Firebase Storage</p>
                </div>

                {userUploads.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Os Meus Uploads (Nuvem)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {userUploads.map(upload => (
                        <button key={upload.id} onClick={() => addImageFromUrl(upload.url)} className="relative group overflow-hidden rounded-lg border border-gray-200 bg-white aspect-square shadow-sm hover:border-[#1e3a8a] transition">
                          <img src={upload.url} alt={upload.name} className="w-full h-full object-cover" crossOrigin="anonymous"/>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <span className="text-white text-xs font-bold px-2 py-1 bg-[#0a1f44]/80 rounded">Inserir</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Banco de Imagens ASC</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addImageFromUrl('https://auditeduca.github.io/asc-consulting.com.br/assets/images/logo-asc-main.png')} className="relative group overflow-hidden rounded-lg border border-gray-200 bg-white aspect-square flex items-center justify-center p-2 hover:border-[#1e3a8a] transition">
                      <img src="https://auditeduca.github.io/asc-consulting.com.br/assets/images/logo-asc-main.png" alt="Logótipo ASC" className="w-full h-auto object-contain" crossOrigin="anonymous"/>
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[#0a1f44] text-xs font-bold px-2 py-1 bg-white/90 rounded shadow-sm">Inserir</span>
                      </div>
                    </button>
                    {CORPORATE_ASSETS.map(asset => (
                      <button key={asset.id} onClick={() => addImageFromUrl(asset.url)} className="relative group overflow-hidden rounded-lg border border-gray-200 bg-white aspect-square">
                        <img src={asset.url} alt={asset.label} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" crossOrigin="anonymous"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-2 py-1 bg-[#0a1f44]/80 rounded">Inserir</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-purple-800">
                    <Sparkles size={20} />
                    <h3 className="font-bold text-sm">Assistente Gemini IA</h3>
                  </div>
                  <p className="text-xs text-purple-700 mb-4">Gere textos curtos e impactantes para as suas imagens corporativas num instante.</p>
                  
                  <textarea 
                    className="w-full text-sm p-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3 resize-none h-24 shadow-inner"
                    placeholder="Ex: Título impactante para anunciar um novo artigo sobre consultoria."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  
                  <button 
                    onClick={generateWithGemini}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white font-bold text-sm transition shadow-sm ${isGeneratingAi || !aiPrompt.trim() ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {isGeneratingAi ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {isGeneratingAi ? 'A pensar...' : 'Gerar Ideias'}
                  </button>
                </div>

                {aiResult && (
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resultado da IA:</p>
                    <p className="text-sm text-gray-800 font-medium mb-4 italic">"{aiResult}"</p>
                    <button 
                      onClick={addAiTextToCanvas}
                      className="w-full flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg text-sm font-bold text-[#1e3a8a] transition"
                    >
                      <Type size={16} />
                      Inserir no Ecrã
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alojados na Nuvem</h3>
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Sincronizado</span>
                </div>
                
                {savedProjects.length === 0 ? (
                  <div className="text-center p-6 bg-white border border-gray-200 rounded-lg border-dashed">
                    <FolderOpen size={32} className="mx-auto text-gray-300 mb-2"/>
                    <p className="text-sm text-gray-500">Nenhum projeto guardado.</p>
                  </div>
                ) : (
                  savedProjects.map(proj => (
                    <div key={proj.id} onClick={() => loadProject(proj)} className="w-full bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:border-[#1e3a8a] transition cursor-pointer group">
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm text-gray-800 truncate">{proj.name}</p>
                        <p className="text-xs text-gray-400">{new Date(proj.date).toLocaleDateString('pt-PT')} às {new Date(proj.date).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <button onClick={(e) => deleteProject(proj.id, e)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded opacity-0 group-hover:opacity-100" title="Eliminar"><Trash2 size={16} /></button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ÁREA CENTRAL - CANVAS */}
        <main className="flex-1 bg-gray-200 relative flex items-center justify-center overflow-hidden" ref={wrapperRef}>
          <div className="shadow-2xl bg-white transition-transform duration-200 ease-in-out origin-center" style={{ width: PRESETS[currentPreset].width, height: PRESETS[currentPreset].height, transform: `scale(${scale})` }}>
            <canvas ref={canvasRef} />
          </div>
        </main>

        {/* BARRA LATERAL DIREITA - PROPRIEDADES */}
        <aside className={`w-full md:w-72 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 absolute md:relative right-0 h-full z-30 ${activeObject ? 'translate-x-0 shadow-2xl md:shadow-none' : 'translate-x-full md:translate-x-0 md:opacity-50 md:pointer-events-none'}`}>
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Propriedades</h3>
            {activeObject && <button onClick={deleteActiveObject} className="text-red-500 hover:bg-red-100 p-2 rounded transition" title="Eliminar"><Trash2 size={18} /></button>}
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            {!activeObject ? (
              <div className="text-center text-gray-400 mt-10"><MousePointer2 size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Selecione um elemento para editar.</p></div>
            ) : (
              <>
                {(activeObject.type === 'i-text' || activeObject.type === 'textbox') && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Tipo de Letra</label>
                      <select className="w-full border border-gray-300 rounded p-2 text-sm text-gray-700" value={typeof activeObject.fontFamily === 'string' ? activeObject.fontFamily : 'Helvetica'} onChange={(e) => updateActiveObjectProperty('fontFamily', e.target.value)}>
                        {FONTS.map(font => <option key={font} value={font}>{font}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Tamanho</label>
                        <span className="text-xs text-gray-400 font-mono">{Number(activeObject.fontSize) || 40}px</span>
                      </div>
                      <input type="range" min="12" max="300" value={Number(activeObject.fontSize) || 40} onChange={(e) => updateActiveObjectProperty('fontSize', parseInt(e.target.value))} className="w-full accent-[#0a1f44]" />
                    </div>
                  </div>
                )}
                {(activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'rect' || activeObject.type === 'circle') && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-gray-500 mb-3 uppercase">Cor</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {BRAND_COLORS.map(color => (
                        <button key={color} className={`w-8 h-8 rounded-full shadow-sm border ${color === '#ffffff' ? 'border-gray-300' : 'border-transparent'} ${activeObject.fill === color ? 'ring-2 ring-offset-2 ring-[#0a1f44] scale-110' : ''}`} style={{ backgroundColor: color }} onClick={() => updateActiveObjectProperty('fill', color)} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-5 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Opacidade</label>
                    <span className="text-xs text-gray-400 font-mono">{Math.round((Number(activeObject.opacity) || 1) * 100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={Number(activeObject.opacity) || 1} onChange={(e) => updateActiveObjectProperty('opacity', parseFloat(e.target.value))} className="w-full accent-[#0a1f44] mb-6" />
                </div>
              </>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}