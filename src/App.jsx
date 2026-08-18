import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar as CalendarIcon, Clock, Users, User, LogIn, LogOut, Plus, Download, Upload, FileText, MessageSquare, Trash2, Edit2, AlertCircle, Key, Eye, EyeOff, X, Check, ArrowLeft, Send, Bell, PlusCircle, Reply } from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyAKYltJBn7OkCqMjO2NY_c8edWUgPJlgZY",
  authDomain: "flowers-for-mary-2027-tasking.firebaseapp.com",
  projectId: "flowers-for-mary-2027-tasking",
  storageBucket: "flowers-for-mary-2027-tasking.firebasestorage.app",
  messagingSenderId: "490311866328",
  appId: "1:490311866328:web:d2038f71180a75286984ad",
  measurementId: "G-0M3FZM7CWJ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'flowers-for-mary-app';

// --- UTILITIES ---
const getTaskColor = (id) => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#fb923c'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
};

const urlify = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => 
    part.match(urlRegex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-600 font-medium hover:underline transition-colors">{part}</a> : part
  );
};

export default function App() {
  // --- STATE ---
  const [fbUser, setFbUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [userRole, setUserRole] = useState({ role: 'guest', username: '' });
  
  // UI State
  const [view, setView] = useState('timeline');
  const [showLogin, setShowLogin] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Password Override
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Edit User
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserName, setEditUserName] = useState('');

  // --- INIT FIREBASE AUTH & DATA ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) { 
        console.error("Auth error:", e);
        if (e.code === 'auth/operation-not-allowed') {
           setAlertConfig({ 
             title: "Action Required in Firebase", 
             message: "Anonymous Authentication is turned off in your Firebase Console! Please go to Firebase > Authentication > Sign-in method > Anonymous and enable it to ensure your app stays in sync.", 
             isError: true 
           });
        }
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setFbUser);
    return unsub;
  }, []);

  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
      setTasks(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, color: data.color || getTaskColor(d.id) };
      }));
      // Instantly set synced to true the moment data arrives!
      setIsSynced(true);
    }, (err) => console.error("Tasks sync error:", err));
    
    const unsubTeam = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'team'), (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Team sync error:", err));
    
    return () => { unsubTasks(); unsubTeam(); };
  }, []);

  const showAlert = (title, message, isError = false, onConfirm = null) => {
    setAlertConfig({ title, message, isError, onConfirm });
  };

  // --- ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const uname = loginUsername.trim();
    if (!uname) return;

    try {
      const credSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'credentials', uname));
      let actualPassword = '';
      let role = 'staff';
      
      if (credSnap.exists()) {
        const credData = credSnap.data();
        actualPassword = credData.password;
        role = credData.role;
      } else {
        if (uname === 'Andres') { actualPassword = 'ProfJAFIggy'; role = 'manager'; }
        else {
          const teamMember = team.find(t => t.name.toLowerCase() === uname.toLowerCase());
          if (teamMember) {
            actualPassword = 'FFM2027';
            role = teamMember.role || 'staff';
          } else {
            setLoginError('User not found.');
            return;
          }
        }
      }

      if (loginPassword === actualPassword) {
        setUserRole({ role, username: uname });
        setShowLogin(false);
        setLoginError('');
      } else {
        setLoginError('Invalid username or password combination.');
      }
    } catch (err) {
      setLoginError('Error verifying credentials.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) return showAlert('Error', 'Password must be at least 4 characters.', true);
    
    let role = 'staff';
    if (passwordTargetUser === 'Andres') role = 'manager';
    else {
       const tm = team.find(t => t.name === passwordTargetUser);
       if (tm) role = tm.role || 'staff';
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'credentials', passwordTargetUser), {
      password: newPassword,
      role: role
    });

    setShowPasswordModal(false);
    setNewPassword('');
    showAlert('Success', `Password updated successfully for ${passwordTargetUser}.`);
  };

  const handleLogout = () => setUserRole({ role: 'guest', username: '' });

  const saveTask = async (taskData) => {
    const id = taskData.id || Date.now().toString();
    const task = { ...taskData, id, color: taskData.color || getTaskColor(id) };
    if (!task.progress) task.progress = 0;
    if (!task.comments) task.comments = [];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), task);
    setShowTaskModal(false);
  };

  const deleteTask = async (id) => {
    showAlert("Delete Task", "Are you sure you want to permanently delete this task?", false, async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id));
    });
  };

  const addTeamMember = async (name, role) => {
    if (!name.trim()) return;
    if (name.toLowerCase() === 'andres' || team.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      return showAlert('Error', 'User already exists.', true);
    }
    const id = Date.now().toString();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', id), { id, name, role });
  };

  const editTeamMember = async (member, newName) => {
    newName = newName.trim();
    if (!newName || newName === member.name) {
      setEditingUserId(null);
      return;
    }
    if (newName.toLowerCase() === 'andres' || team.some(t => t.name.toLowerCase() === newName.toLowerCase())) {
      showAlert("Error", "That username is already taken.", true);
      return;
    }

    for (const t of tasks) {
      let updated = false;
      const updates = {};
      
      if (t.assignee === member.name) {
        updates.assignee = newName;
        updated = true;
      }

      const updateCommentsRecursively = (commentsList) => {
        let listUpdated = false;
        const newList = commentsList.map(c => {
           let cUpdated = false;
           const newC = { ...c };
           if (newC.author === member.name) { newC.author = newName; cUpdated = true; }
           if (newC.replies && newC.replies.length > 0) {
               const { list, changed } = updateCommentsRecursively(newC.replies);
               if (changed) { newC.replies = list; cUpdated = true; }
           }
           if (cUpdated) listUpdated = true;
           return newC;
        });
        return { list: newList, changed: listUpdated };
      };

      if (t.comments && t.comments.length > 0) {
         const { list, changed } = updateCommentsRecursively(t.comments);
         if (changed) { updates.comments = list; updated = true; }
      }
      if (updated) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', t.id), updates);
    }

    try {
      const credRef = doc(db, 'artifacts', appId, 'public', 'data', 'credentials', member.name);
      const credSnap = await getDoc(credRef);
      if (credSnap.exists()) {
         await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'credentials', newName), credSnap.data());
         await deleteDoc(credRef);
      }
    } catch (e) { console.error(e); }

    try {
       const channelsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'chatChannels'));
       channelsSnap.forEach(async (chDoc) => {
          const ch = chDoc.data();
          if (ch.participants && ch.participants.includes(member.name)) {
             const newParts = ch.participants.map(p => p === member.name ? newName : p);
             await updateDoc(chDoc.ref, { participants: newParts });
          }
       });
    } catch (e) { console.error(e); }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', member.id), { name: newName });
    setEditingUserId(null);
  };

  const removeTeamMember = async (member) => {
    showAlert("Remove User", `Remove ${member.name}? Their tasks will be reassigned to Andres.`, false, async () => {
      const memberTasks = tasks.filter(t => t.assignee === member.name);
      for (const t of memberTasks) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', t.id), { assignee: 'Andres' });
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', member.id));
    });
  };

  const updateProgress = async (id, progress) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), { progress: parseInt(progress) });
  };

  const addComment = async (taskId, text) => {
    if (!text.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    const newComment = { id: Date.now().toString(), author: userRole.username, text, timestamp: new Date().toISOString(), replies: [] };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
      comments: [...(task.comments || []), newComment]
    });
  };

  // --- EXPORT / IMPORT / PDF ---
  const handleExport = () => {
    const payload = JSON.stringify({ tasks, team }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    a.download = `Flowers_For_Mary_Data_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.tasks && data.team) {
          for (const member of data.team) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', member.id), member);
          }
          for (const task of data.tasks) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', task.id), task);
          }
          showAlert("Success", "Data successfully imported!");
        } else {
          showAlert("Error", "Invalid backup file format.", true);
        }
      } catch (err) {
        showAlert("Error", "Error parsing file. Ensure it is valid JSON.", true);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset
  };

  const generatePDF = () => {
    if (!window.html2pdf) return showAlert("Notice", "PDF generator is loading. Please try again in a few seconds.");
    const element = document.getElementById('report-content');
    const clone = element.cloneNode(true);
    clone.style.height = 'auto'; 
    clone.style.overflow = 'visible';
    clone.style.resize = 'none';

    const tsDiv = document.createElement('div');
    const now = new Date();
    tsDiv.innerHTML = `<h3 style="color:#4f46e5; margin-bottom: 20px;">Report Generated: ${now.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})</h3>`;
    clone.prepend(tsDiv);

    const dateStr = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    const opt = {
      margin: 0.5,
      filename: `Flowers_For_Mary_Report_${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    window.html2pdf().set(opt).from(clone).save();
  };

  // --- HELPERS ---
  const canEditTask = (task) => userRole.role === 'manager' || (userRole.role === 'staff' && userRole.username === task.assignee);
  const subgroups = [...new Set(tasks.map(t => t.subgroup))];
  const staffAssignees = ["Andres", ...team.filter(t => t.role !== 'viewer').map(t => t.name)];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans p-4 md:p-8 selection:bg-violet-200 selection:text-violet-900 pb-24">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-4 z-40 transition-all">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Flowers for Mary <span className="text-violet-600">2027</span></h1>
          <p className="text-sm text-zinc-500 font-medium flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full shadow-sm ${isSynced ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 animate-pulse shadow-amber-500/50'}`}></span> {isSynced ? 'Live Synced' : 'Syncing...'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {userRole.role === 'guest' ? (
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium">
              <LogIn size={16} /> Login
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-zinc-100/80 px-4 py-2 rounded-2xl border border-zinc-200/50">
                <span className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                  <div className="bg-violet-100 text-violet-700 p-1 rounded-full"><User size={14}/></div>
                  {userRole.username} <span className="text-zinc-400 font-normal ml-1">({userRole.role})</span>
                </span>
                <div className="w-px h-4 bg-zinc-300 mx-1"></div>
                <button onClick={() => { setPasswordTargetUser(userRole.username); setShowPasswordModal(true); }} className="text-zinc-400 hover:text-violet-600 transition-colors" title="Change My Password">
                  <Key size={16}/>
                </button>
              </div>
              
              {userRole.role === 'manager' && (
                <>
                  <button onClick={() => setShowTeamModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm font-medium">
                    <Users size={16} /> Users
                  </button>
                  <div className="flex bg-white border border-zinc-200 rounded-xl shadow-sm p-0.5">
                    <button onClick={handleExport} className="flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors" title="Export Backup JSON">
                      <Download size={18} />
                    </button>
                    <div className="w-px bg-zinc-200 my-1"></div>
                    <label className="flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer" title="Import Backup JSON">
                      <Upload size={18} />
                      <input type="file" onChange={handleImport} accept="application/json,.json" className="hidden" />
                    </label>
                  </div>
                </>
              )}
              
              <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2.5 text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm font-medium">
                <FileText size={16} /> Report
              </button>
              
              {userRole.role !== 'viewer' && (
                <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 hover:shadow-[0_4px_14px_0_rgb(124,58,237,0.39)] hover:-translate-y-0.5 transition-all duration-200 font-medium">
                  <Plus size={16} /> New Task
                </button>
              )}
              
              <button onClick={handleLogout} className="flex items-center justify-center p-2.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Logout">
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div id="report-content" className="max-w-7xl mx-auto space-y-8">
        {/* SCHEDULE VIEW */}
        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.03)] border border-zinc-100 p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-zinc-800 flex items-center gap-3">
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl"><CalendarIcon size={20}/></div>
              Project Schedule
            </h2>
            <div className="flex bg-zinc-100/80 rounded-xl p-1 border border-zinc-200/50 backdrop-blur-sm">
              <button onClick={() => setView('timeline')} className={`px-5 py-2 text-sm rounded-lg transition-all duration-200 ${view === 'timeline' ? 'bg-white shadow-sm font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 font-medium'}`}>Timeline</button>
              <button onClick={() => setView('calendar')} className={`px-5 py-2 text-sm rounded-lg transition-all duration-200 ${view === 'calendar' ? 'bg-white shadow-sm font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 font-medium'}`}>Calendar</button>
            </div>
          </div>
          <div className="border border-zinc-100 rounded-2xl overflow-auto bg-[#FAFAFA] p-6 shadow-inner" style={{ height: '420px' }}>
            {view === 'timeline' ? (
              <Timeline tasks={tasks} onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} />
            ) : (
              <Calendar tasks={tasks} onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} />
            )}
          </div>
        </div>

        {/* TASK LIST */}
        <div>
           <div className="flex items-center gap-3 mb-6 px-2">
             <div className="p-2 bg-violet-50 text-violet-600 rounded-xl"><Clock size={20}/></div>
             <h2 className="text-xl font-bold tracking-tight text-zinc-800">Task Subgroups</h2>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {subgroups.map(sg => {
                const sgTasks = tasks.filter(t => t.subgroup === sg);
                const avgProgress = sgTasks.length ? Math.round(sgTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / sgTasks.length) : 0;
                
                return (
                  <div key={sg} className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.03)] border border-zinc-100 p-6 lg:p-8 flex flex-col h-full hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow duration-300">
                     <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{sg}</h3>
                        <span className="text-xs font-bold px-3 py-1.5 bg-zinc-100 rounded-full text-zinc-600 uppercase tracking-wider">{avgProgress}% Done</span>
                     </div>
                     <div className="w-full bg-zinc-100 h-2.5 rounded-full mb-8 overflow-hidden shadow-inner">
                        <div className="bg-violet-500 h-full transition-all duration-700 ease-out" style={{width: `${avgProgress}%`}}></div>
                     </div>
                     <div className="space-y-4 flex-1">
                        {sgTasks.map(task => (
                           <div key={task.id} className="p-5 bg-[#FAFAFA] rounded-2xl border border-zinc-200/60 hover:bg-white hover:border-violet-200 hover:shadow-[0_4px_20px_rgb(0,0,0,0.04)] transition-all duration-300 group relative">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: task.color }}></div>
                                  <span className="font-semibold text-zinc-800">{task.name}</span>
                                </div>
                                {canEditTask(task) && (
                                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1 border border-zinc-100 shadow-sm">
                                     <button onClick={() => { setEditingTask(task); setShowTaskModal(true); }} className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"><Edit2 size={14}/></button>
                                     {userRole.role === 'manager' && <button onClick={() => deleteTask(task.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 size={14}/></button>}
                                   </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-xs font-medium text-zinc-500 mb-4 px-1">
                                 <span className="flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1 rounded-md"><User size={12}/> {task.assignee}</span>
                                 <span className="text-zinc-400">{formatDate(task.startDate)} - {formatDate(task.endDate)}</span>
                              </div>
                              <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                                 <input 
                                   type="range" min="0" max="100" 
                                   value={task.progress || 0} disabled={!canEditTask(task)}
                                   onChange={(e) => updateProgress(task.id, e.target.value)}
                                   className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-zinc-100"
                                   style={{ background: `linear-gradient(to right, ${task.color} ${task.progress}%, #f4f4f5 ${task.progress}%)`}}
                                 />
                                 <span className="text-xs font-bold text-zinc-700 w-9 text-right">{task.progress || 0}%</span>
                              </div>
                              
                              <div className="mt-4 pt-4 border-t border-zinc-200/60">
                                <details className="group/details" open={task.comments?.length > 0}>
                                  <summary className={`text-xs cursor-pointer flex items-center gap-1.5 transition-colors select-none ${task.comments?.length > 0 ? 'font-bold text-violet-600' : 'font-semibold text-zinc-400 hover:text-zinc-700'}`}>
                                    <MessageSquare size={14}/> {task.comments?.length || 0} Comments
                                  </summary>
                                  <div className="mt-4 space-y-3">
                                    <CommentThread comments={task.comments || []} taskId={task.id} userRole={userRole} db={db} appId={appId} tasks={tasks} showAlert={showAlert} />
                                    {userRole.role !== 'guest' && (
                                      <form onSubmit={(e) => { e.preventDefault(); addComment(task.id, e.target.elements.comment.value); e.target.reset(); }} className="flex gap-2 mt-3 relative">
                                        <input name="comment" type="text" placeholder="Write a comment..." className="flex-1 text-sm p-3 pr-20 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm" required/>
                                        <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 transition-colors">Post</button>
                                      </form>
                                    )}
                                  </div>
                                </details>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )
              })}
              {subgroups.length === 0 && (
                <div className="col-span-full text-center py-20 text-zinc-400 bg-white rounded-3xl border-2 border-dashed border-zinc-200">
                  <div className="mx-auto w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4"><Clock size={24} className="text-zinc-300"/></div>
                  <p className="font-medium text-zinc-500">No tasks or subgroups created yet.</p>
                  <p className="text-sm mt-1">Click "New Task" in the header to get started.</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* --- CHAT WIDGET --- */}
      {userRole.role !== 'guest' && <ChatPanel db={db} appId={appId} userRole={userRole} team={team} showAlert={showAlert} />}

      {/* --- MODALS --- */}
      
      {/* Alert / Confirm Modal */}
      {alertConfig && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h2 className={`text-xl font-bold tracking-tight mb-3 ${alertConfig.isError ? 'text-rose-600' : 'text-zinc-900'}`}>{alertConfig.title}</h2>
            <p className="text-zinc-600 mb-8 leading-relaxed">{alertConfig.message}</p>
            <div className="flex justify-end gap-3">
              {alertConfig.onConfirm && <button onClick={() => setAlertConfig(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>}
              <button 
                onClick={() => { if (alertConfig.onConfirm) alertConfig.onConfirm(); setAlertConfig(null); }} 
                className={`px-6 py-2.5 text-white font-semibold rounded-xl transition-all shadow-sm ${alertConfig.isError ? 'bg-rose-600 hover:bg-rose-700 hover:shadow-[0_4px_14px_0_rgb(225,29,72,0.39)]' : 'bg-zinc-900 hover:bg-zinc-800 hover:shadow-lg'}`}
              >
                {alertConfig.onConfirm ? 'Confirm' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold tracking-tight mb-6">Set Password for {passwordTargetUser}</h2>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"} autoFocus required value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full p-3.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none pr-12 transition-all font-medium" 
                  placeholder="New password..." 
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-3.5 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showNewPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all shadow-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6">
               <LogIn size={24} className="text-zinc-700"/>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-6">Welcome back</h2>
            {loginError && <div className="mb-6 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl flex items-center gap-2 border border-rose-100"><AlertCircle size={16}/>{loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Username</label>
                <input type="text" autoFocus required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium" placeholder="e.g. Andres" />
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Password</label>
                <input type={showLoginPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none pr-12 transition-all font-medium" placeholder="••••••••"/>
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-10 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showLoginPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100">
                <button type="button" onClick={() => setShowLogin(false)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all shadow-sm">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold tracking-tight mb-6">Manage Team</h2>
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex justify-between items-center p-3 bg-[#FAFAFA] border border-zinc-200/60 rounded-2xl">
                <div className="flex flex-col">
                   <span className="font-semibold text-zinc-900">Andres</span>
                   <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mt-0.5">Manager</span>
                </div>
                <button onClick={() => { setPasswordTargetUser('Andres'); setShowPasswordModal(true); }} className="text-amber-500 hover:text-amber-600 bg-amber-50 p-2 rounded-lg transition-colors" title="Set Custom Password"><Key size={16}/></button>
              </div>
              {team.map(member => (
                editingUserId === member.id ? (
                  <div key={member.id} className="flex items-center gap-2 p-3 bg-white border-2 border-violet-200 rounded-2xl shadow-sm">
                    <input autoFocus value={editUserName} onChange={e => setEditUserName(e.target.value)} className="flex-1 p-2 text-sm font-medium border border-zinc-200 rounded-lg outline-none focus:border-violet-500" />
                    <button onClick={() => editTeamMember(member, editUserName)} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 p-2 rounded-lg transition-colors"><Check size={16}/></button>
                    <button onClick={() => setEditingUserId(null)} className="text-zinc-500 hover:text-zinc-700 bg-zinc-100 p-2 rounded-lg transition-colors"><X size={16}/></button>
                  </div>
                ) : (
                  <div key={member.id} className="flex justify-between items-center p-3 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-300 hover:shadow-sm transition-all group">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900">{member.name}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">{member.role || 'staff'}</span>
                    </div>
                    <div className="flex gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingUserId(member.id); setEditUserName(member.name); }} className="text-blue-600 hover:text-blue-700 bg-blue-50 p-2 rounded-lg transition-colors" title="Edit Username"><Edit2 size={14}/></button>
                      <button onClick={() => { setPasswordTargetUser(member.name); setShowPasswordModal(true); }} className="text-amber-600 hover:text-amber-700 bg-amber-50 p-2 rounded-lg transition-colors" title="Set Custom Password"><Key size={14}/></button>
                      <button onClick={() => removeTeamMember(member)} className="text-rose-600 hover:text-rose-700 bg-rose-50 p-2 rounded-lg transition-colors" title="Delete User"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )
              ))}
            </div>
            
            <div className="pt-6 border-t border-zinc-100">
               <label className="block text-sm font-semibold text-zinc-700 mb-3 ml-1">Add New Member</label>
               <form onSubmit={e => { e.preventDefault(); const t = e.target; addTeamMember(t.name.value, t.role.value); t.reset(); }} className="flex gap-2">
                 <input name="name" type="text" placeholder="Name..." className="flex-1 p-3 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" required />
                 <select name="role" className="p-3 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-violet-500 transition-all cursor-pointer">
                    <option value="staff">Staff</option>
                    <option value="viewer">Viewer</option>
                 </select>
                 <button type="submit" className="px-4 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all shadow-sm">Add</button>
               </form>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setShowTeamModal(false)} className="px-6 py-2.5 text-zinc-700 font-medium bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && <TaskFormModal task={editingTask} onClose={() => setShowTaskModal(false)} onSave={saveTask} subgroups={subgroups} assignees={staffAssignees} />}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function CommentThread({ comments, taskId, userRole, db, appId, tasks, showAlert, parentIds = [] }) {
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);

  const performUpdate = async (updatedComments) => {
    let newTasks = [...tasks];
    let taskIndex = newTasks.findIndex(t => t.id === taskId);
    let updatedTask = { ...newTasks[taskIndex] };
    
    if (parentIds.length === 0) {
      updatedTask.comments = updatedComments;
    } else {
      let currentLevel = updatedTask.comments;
      for (let i = 0; i < parentIds.length - 1; i++) {
        let node = currentLevel.find(c => c.id === parentIds[i]);
        currentLevel = node.replies;
      }
      let targetNode = currentLevel.find(c => c.id === parentIds[parentIds.length - 1]);
      targetNode.replies = updatedComments;
    }
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { comments: updatedTask.comments });
  };

  const saveEdit = (id, newText) => {
    const updated = comments.map(c => c.id === id ? { ...c, text: newText } : c);
    performUpdate(updated);
    setEditingCommentId(null);
  };

  const deleteComment = (id) => {
    showAlert("Delete Comment", "Remove this comment?", false, () => {
      const updated = comments.filter(c => c.id !== id);
      performUpdate(updated);
    });
  };

  const addReply = (parentId, text) => {
    const newReply = { id: Date.now().toString(), author: userRole.username, text, timestamp: new Date().toISOString(), replies: [] };
    const updated = comments.map(c => c.id === parentId ? { ...c, replies: [...(c.replies || []), newReply] } : c);
    performUpdate(updated);
    setReplyingToId(null);
  };

  return (
    <div className={`space-y-3 ${parentIds.length > 0 ? 'ml-6 pl-4 border-l-2 border-zinc-100' : ''}`}>
      {comments.map((c) => {
        const canEdit = userRole.role === 'manager' || userRole.username === c.author;
        return (
          <div key={c.id}>
            <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm text-sm group/comment relative hover:border-zinc-200 hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start mb-1">
                <div className="font-semibold text-zinc-900">{c.author} <span className="text-zinc-400 font-normal text-xs ml-2">{new Date(c.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span></div>
                {canEdit && editingCommentId !== c.id && (
                  <div className="flex gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity absolute right-3 top-3 bg-white pl-2">
                    <button onClick={() => setReplyingToId(c.id)} className="p-1 text-zinc-400 hover:text-blue-600 bg-white rounded transition-colors" title="Reply"><Reply size={14}/></button>
                    <button onClick={() => setEditingCommentId(c.id)} className="p-1 text-zinc-400 hover:text-violet-600 bg-white rounded transition-colors" title="Edit"><Edit2 size={14}/></button>
                    <button onClick={() => deleteComment(c.id)} className="p-1 text-zinc-400 hover:text-rose-600 bg-white rounded transition-colors" title="Delete"><Trash2 size={14}/></button>
                  </div>
                )}
                {!canEdit && userRole.role !== 'guest' && (
                  <div className="opacity-0 group-hover/comment:opacity-100 transition-opacity absolute right-3 top-3 bg-white pl-2">
                     <button onClick={() => setReplyingToId(c.id)} className="p-1 text-zinc-400 hover:text-blue-600 bg-white rounded transition-colors" title="Reply"><Reply size={14}/></button>
                  </div>
                )}
              </div>
              
              {editingCommentId === c.id ? (
                <form onSubmit={e => { e.preventDefault(); saveEdit(c.id, e.target.elements.txt.value); }} className="mt-3 flex gap-2">
                  <input name="txt" defaultValue={c.text} autoFocus className="flex-1 p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-violet-500 font-medium"/>
                  <button type="submit" className="px-3 bg-zinc-900 text-white rounded-lg font-semibold hover:bg-zinc-800"><Check size={14}/></button>
                  <button type="button" onClick={() => setEditingCommentId(null)} className="px-3 bg-zinc-100 text-zinc-600 rounded-lg font-semibold hover:bg-zinc-200"><X size={14}/></button>
                </form>
              ) : (
                <div className="text-zinc-600 mt-1.5 break-words leading-relaxed">{urlify(c.text)}</div>
              )}
            </div>
            
            {replyingToId === c.id && (
              <form onSubmit={e => { e.preventDefault(); addReply(c.id, e.target.elements.replyTxt.value); }} className="mt-2 flex gap-2 ml-6 pl-4 border-l-2 border-violet-200 relative">
                  <input name="replyTxt" placeholder="Write a reply..." autoFocus className="flex-1 p-2.5 pr-20 border border-violet-200 rounded-xl text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 bg-violet-50/50 shadow-sm transition-all"/>
                  <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                     <button type="submit" className="px-3 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 shadow-sm">Reply</button>
                     <button type="button" onClick={() => setReplyingToId(null)} className="px-2 bg-white text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50"><X size={14}/></button>
                  </div>
              </form>
            )}

            {c.replies && c.replies.length > 0 && (
              <div className="mt-3">
                 <CommentThread comments={c.replies} taskId={taskId} userRole={userRole} db={db} appId={appId} tasks={tasks} showAlert={showAlert} parentIds={[...parentIds, c.id]} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  );
}

function TaskFormModal({ task, onClose, onSave, subgroups, assignees }) {
  const [name, setName] = useState(task?.name || '');
  const [subgroupMode, setSubgroupMode] = useState(task?.subgroup ? 'existing' : 'new');
  const [subgroupSelect, setSubgroupSelect] = useState(task?.subgroup || (subgroups[0] || ''));
  const [subgroupNew, setSubgroupNew] = useState('');
  const [assignee, setAssignee] = useState(task?.assignee || assignees[0]);
  const [startDate, setStartDate] = useState(task?.startDate || '');
  const [endDate, setEndDate] = useState(task?.endDate || '');
  const [color, setColor] = useState(task?.color || '#8b5cf6');

  const presetColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#52525b', '#18181b'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (startDate > endDate) return alert("End Date must be after Start Date!");
    const finalSubgroup = subgroupMode === 'new' ? subgroupNew : subgroupSelect;
    if (!finalSubgroup.trim()) return alert("Subgroup is required.");
    onSave({ ...task, name, subgroup: finalSubgroup, assignee, startDate, endDate, color });
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-md p-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <h2 className="text-2xl font-bold tracking-tight mb-6">{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Task Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Subgroup</label>
            <select value={subgroupMode === 'new' ? 'NEW' : subgroupSelect} onChange={e => { if(e.target.value === 'NEW') setSubgroupMode('new'); else { setSubgroupMode('existing'); setSubgroupSelect(e.target.value); } }} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium mb-3 cursor-pointer">
              {subgroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
              <option value="NEW" className="font-bold text-violet-600">+ Create New Subgroup...</option>
            </select>
            {subgroupMode === 'new' && <input type="text" autoFocus required placeholder="Type new subgroup name..." value={subgroupNew} onChange={e => setSubgroupNew(e.target.value)} className="w-full p-3.5 bg-white border border-violet-300 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium shadow-sm" />}
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Assignee</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white transition-all font-medium cursor-pointer">
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">Start Date</label>
              <input type="date" required value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white transition-all font-medium" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5 ml-1">End Date</label>
              <input type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white transition-all font-medium" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-zinc-100">
             <label className="block text-sm font-semibold text-zinc-700 mb-3 ml-1">Task Color</label>
             <div className="flex flex-wrap gap-2.5 mb-4">
                {presetColors.map(c => (
                   <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${color === c ? 'border-zinc-900 scale-110 shadow-md' : 'border-transparent hover:scale-110 hover:shadow-sm'}`} style={{backgroundColor: c}}></button>
                ))}
             </div>
             <div className="flex items-center gap-3 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 w-max">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Custom:</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
             </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all shadow-sm">Save Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- CHAT COMPONENTS ---

function ChatPanel({ db, appId, userRole, team, showAlert }) {
  const [isOpen, setIsOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const messagesEndRef = useRef(null);

  const audioCtxRef = useRef(null);
  
  const playChime = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
  };

  useEffect(() => {
    if (!userRole.username) return;
    const presenceRef = doc(db, 'artifacts', appId, 'public', 'data', 'presence', userRole.username);
    setDoc(presenceRef, { online: true, lastSeen: serverTimestamp() });
    
    const unsubPresence = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'presence'), snap => {
       const o = {};
       snap.forEach(d => { if(d.data().online) o[d.id] = true; });
       setOnlineUsers(o);
    });

    const handleUnload = () => setDoc(presenceRef, { online: false });
    window.addEventListener('beforeunload', handleUnload);
    return () => { window.removeEventListener('beforeunload', handleUnload); setDoc(presenceRef, { online: false }); unsubPresence(); };
  }, [userRole.username, db, appId]);

  useEffect(() => {
    const unsubChannels = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chatChannels')), (snap) => {
      let chs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      chs = chs.filter(ch => ch.id === 'general' || ch.participants?.includes(userRole.username) || userRole.role === 'manager');
      if (!chs.find(c => c.id === 'general')) chs.unshift({ id: 'general', name: 'Team Chat', participants: [] });
      setChannels(chs);
    });
    return unsubChannels;
  }, [db, appId, userRole]);

  useEffect(() => {
    const unsubMessages = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chatMessages'), orderBy('timestamp', 'asc')), (snap) => {
       const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       
       if (activeChannel) setMessages(allMsgs.filter(m => m.channelId === activeChannel.id));
       
       const lastRead = JSON.parse(localStorage.getItem(`ffm_chat_read_${userRole.username}`) || '{}');
       const counts = {};
       let playSound = false;

       allMsgs.forEach(m => {
          if (m.author !== userRole.username) {
             const readTime = lastRead[m.channelId] || 0;
             if (m.timestamp > readTime) {
                counts[m.channelId] = (counts[m.channelId] || 0) + 1;
                if (!isOpen || activeChannel?.id !== m.channelId) {
                   const timeDiff = Date.now() - m.timestamp;
                   if (timeDiff < 2000) playSound = true;
                }
             }
          }
       });
       setUnreadCounts(counts);
       if (playSound) playChime();

    });
    return unsubMessages;
  }, [db, appId, activeChannel, isOpen, userRole.username]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const markRead = (channelId) => {
    const lastRead = JSON.parse(localStorage.getItem(`ffm_chat_read_${userRole.username}`) || '{}');
    lastRead[channelId] = Date.now();
    localStorage.setItem(`ffm_chat_read_${userRole.username}`, JSON.stringify(lastRead));
    setUnreadCounts(prev => ({...prev, [channelId]: 0}));
  };

  const handleOpenChannel = (ch) => {
    setActiveChannel(ch);
    markRead(ch.id);
  };

  const handleToggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && activeChannel) markRead(activeChannel.id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chatMessages'), {
      channelId: activeChannel.id,
      author: userRole.username,
      text: newMessage,
      timestamp: Date.now()
    });
    setNewMessage('');
    markRead(activeChannel.id);
  };

  const createChannel = async () => {
    if (selectedUsers.length === 0) return;
    const participants = [userRole.username, ...selectedUsers];
    const newCh = { participants, timestamp: Date.now(), type: selectedUsers.length === 1 ? 'dm' : 'group' };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chatChannels'), newCh);
    setShowCreate(false);
    setSelectedUsers([]);
  };

  const deleteChannel = async () => {
    showAlert("Delete Chat", "Permanently delete this thread for everyone?", false, async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chatChannels', activeChannel.id));
      setActiveChannel(null);
    });
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const everyoneElse = team.map(t => t.name).filter(n => n !== userRole.username);
  if (userRole.username !== 'Andres') everyoneElse.unshift('Andres');

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
       {/* Chat Window */}
       {isOpen && (
          <div className="bg-white/95 backdrop-blur-xl sm:border border-zinc-200/60 sm:rounded-3xl shadow-[0_12px_40px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fixed inset-0 sm:relative sm:inset-auto w-full h-full sm:w-[360px] sm:h-[580px] sm:mb-5 z-[70]">
            {!activeChannel ? (
               /* LOBBY VIEW */
               <div className="flex flex-col h-full">
                 <div className="bg-zinc-900 p-5 text-white flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),20px)] sm:pt-5 border-b border-zinc-800">
                    <h3 className="font-bold tracking-tight text-lg flex items-center gap-2"><MessageSquare size={18}/> Messages</h3>
                    <div className="flex gap-2">
                       <button onClick={() => setShowCreate(!showCreate)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"><PlusCircle size={18}/></button>
                       <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"><X size={18}/></button>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-3 space-y-2">
                    {showCreate && (
                       <div className="bg-white p-4 rounded-2xl border border-zinc-200 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                          <h4 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wider">New Conversation</h4>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4 custom-scrollbar">
                             {everyoneElse.map(u => (
                                <label key={u} className="flex items-center gap-3 text-sm p-2 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-zinc-100 font-medium">
                                   <input type="checkbox" checked={selectedUsers.includes(u)} className="rounded text-violet-600 focus:ring-violet-500/20" onChange={e => {
                                      if (e.target.checked) setSelectedUsers([...selectedUsers, u]);
                                      else setSelectedUsers(selectedUsers.filter(x => x !== u));
                                   }}/>
                                   {u}
                                </label>
                             ))}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => setShowCreate(false)} className="flex-1 px-3 py-2 bg-zinc-100 text-zinc-600 font-medium rounded-xl text-sm hover:bg-zinc-200 transition-colors">Cancel</button>
                             <button onClick={createChannel} disabled={selectedUsers.length===0} className="flex-1 px-3 py-2 bg-zinc-900 text-white font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-zinc-800 transition-colors shadow-sm">Start</button>
                          </div>
                       </div>
                    )}

                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 pt-2 pb-1">Channels</div>
                    {channels.map(ch => {
                       const isGeneral = ch.id === 'general';
                       const name = isGeneral ? 'Team Chat' : ch.participants.filter(p => p !== userRole.username).join(', ');
                       const unread = unreadCounts[ch.id] || 0;
                       
                       return (
                          <button key={ch.id} onClick={() => handleOpenChannel(ch)} className="w-full flex justify-between items-center p-3.5 bg-white rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 text-left group">
                             <div className="flex items-center gap-3 truncate pr-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isGeneral ? 'bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white' : 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-900 group-hover:text-white'}`}>
                                   {isGeneral ? <Users size={18}/> : <User size={18}/>}
                                </div>
                                <span className="font-semibold text-zinc-800 truncate">{name}</span>
                             </div>
                             {unread > 0 && <span className="bg-rose-500 shadow-rose-500/30 shadow-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-in zoom-in">{unread}</span>}
                          </button>
                       )
                    })}
                 </div>
                 
                 <div className="p-4 border-t border-zinc-100 bg-white shrink-0 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 rounded-b-3xl">
                    <div className="text-[10px] font-bold text-zinc-400 mb-2.5 uppercase tracking-wider">Online Now</div>
                    <div className="flex flex-wrap gap-2">
                       {Object.keys(onlineUsers).map(u => (
                          <span key={u} className="flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg border border-emerald-100/50">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>{u}
                          </span>
                       ))}
                    </div>
                 </div>
               </div>
            ) : (
               /* ROOM VIEW */
               <div className="flex flex-col h-full bg-[#FAFAFA]">
                  <div className="bg-white p-4 flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),16px)] sm:pt-4 border-b border-zinc-100 shadow-sm z-10">
                     <div className="flex items-center gap-3 truncate">
                        <button onClick={() => { setActiveChannel(null); markRead(activeChannel.id); }} className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl transition-colors"><ArrowLeft size={16}/></button>
                        <span className="font-bold tracking-tight text-zinc-900 truncate">{activeChannel.id === 'general' ? 'Team Chat' : activeChannel.participants.filter(p => p !== userRole.username).join(', ')}</span>
                     </div>
                     <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {activeChannel.id !== 'general' && userRole.role === 'manager' && (
                           <button onClick={deleteChannel} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Delete Chat"><Trash2 size={16}/></button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"><X size={18}/></button>
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                     {messages.length === 0 && (
                        <div className="text-center text-zinc-400 text-sm mt-12 flex flex-col items-center gap-3">
                           <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center"><MessageSquare size={20} className="text-zinc-300"/></div>
                           Start the conversation!
                        </div>
                     )}
                     {messages.map((m, idx) => {
                        const isMe = m.author === userRole.username;
                        const showAuthor = idx === 0 || messages[idx-1].author !== m.author;
                        return (
                           <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              {showAuthor && !isMe && <span className="text-[10px] font-bold text-zinc-400 mb-1 px-1 ml-1">{m.author}</span>}
                              <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm break-words shadow-sm ${isMe ? 'bg-zinc-900 text-white rounded-br-sm' : 'bg-white border border-zinc-200/60 text-zinc-800 rounded-bl-sm'}`}>
                                 {urlify(m.text)}
                              </div>
                           </div>
                        )
                     })}
                     <div ref={messagesEndRef} className="h-2" />
                  </div>
                  
                  <form onSubmit={sendMessage} className="p-4 bg-white border-t border-zinc-100 flex gap-2.5 shrink-0 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 rounded-b-3xl">
                     <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-full text-sm outline-none focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all font-medium" />
                     <button type="submit" disabled={!newMessage.trim()} className="w-12 h-12 bg-violet-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-300 shrink-0 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-600/30 transition-all duration-200"><Send size={18} className="ml-1"/></button>
                  </form>
               </div>
            )}
          </div>
       )}

       {/* Chat Button (Hidden on Mobile when Chat is Open) */}
       <button onClick={handleToggleChat} className={`w-16 h-16 bg-zinc-900 text-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] items-center justify-center hover:bg-zinc-800 hover:scale-105 transition-all duration-300 relative outline-none focus:ring-4 focus:ring-zinc-500/30 ${isOpen ? 'hidden sm:flex' : 'flex'}`}>
          <MessageSquare size={26} />
          {totalUnread > 0 && !isOpen && (
             <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in">{totalUnread}</span>
          )}
       </button>
    </div>
  );
}

function Timeline({ tasks, onTaskClick }) {
  if (!tasks.length) return (
     <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center"><CalendarIcon size={20} className="text-zinc-300"/></div>
        <p className="font-medium">No tasks to display</p>
     </div>
  );
  
  const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
  const minDate = new Date(Math.min(...allDates));
  minDate.setDate(minDate.getDate() - 7);
  const maxDate = new Date(Math.max(...allDates));
  maxDate.setDate(maxDate.getDate() + 14);
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const dayWidth = 44; 

  return (
    <div className="relative min-w-max min-h-full pb-8">
      <div className="flex sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-md z-10 border-b border-zinc-200/60 pb-1 pt-1">
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = new Date(minDate);
          d.setDate(d.getDate() + i);
          const isFirstOfMonth = d.getDate() === 1;
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={i} className={`flex-shrink-0 border-r border-zinc-100 flex flex-col items-center justify-end pb-1.5 ${isToday ? 'bg-violet-50 rounded-t-lg border-violet-100' : ''}`} style={{ width: dayWidth }}>
              {isFirstOfMonth && <span className="absolute top-0 text-[11px] font-bold text-zinc-800 whitespace-nowrap ml-1 uppercase tracking-wider">{d.toLocaleString('default', { month: 'short' })}</span>}
              <span className={`text-[10px] font-bold mt-6 ${isToday ? 'text-violet-600' : 'text-zinc-400'}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      
      <div className="pt-6 space-y-3.5 relative">
        {tasks.map(task => {
          const start = new Date(task.startDate);
          const end = new Date(task.endDate);
          const leftDays = Math.floor((start - minDate) / (1000 * 60 * 60 * 24));
          const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          
          return (
             <div key={task.id} className="relative h-9 group" style={{ width: totalDays * dayWidth }}>
                <div 
                  onClick={() => onTaskClick(task)}
                  className="absolute h-7 top-1 rounded-lg shadow-sm border border-black/5 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md hover:ring-2 hover:ring-violet-400/50 z-10 cursor-pointer flex items-center"
                  style={{ 
                    left: leftDays * dayWidth, width: Math.max(durationDays * dayWidth, 12),
                    backgroundColor: `${task.color}15`, borderLeft: `4px solid ${task.color}`
                  }}
                  title={`${task.name} (${task.progress || 0}%) - Click to Edit`}
                >
                  <div className="absolute bottom-0 left-0 h-1 opacity-40 transition-all duration-500 ease-out" style={{ width: `${task.progress || 0}%`, backgroundColor: task.color }}></div>
                  <span className="relative px-2.5 text-xs font-semibold text-zinc-800 truncate z-10 drop-shadow-sm">{task.name}</span>
                </div>
             </div>
          );
        })}
        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-violet-400 z-0 opacity-50 pointer-events-none" style={{ left: Math.floor((new Date() - minDate) / (1000 * 60 * 60 * 24)) * dayWidth + (dayWidth/2) }}></div>
      </div>
    </div>
  );
}

function Calendar({ tasks, onTaskClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const days = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const totalSlots = Math.ceil((days + firstDay) / 7) * 7;
  
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); };
  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); };

  const formatCalDate = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  
  const weeks = [];
  let currentWeek = [];
  for (let i = 0; i < totalSlots; i++) {
     const dayNum = i - firstDay + 1;
     const isCurrentMonth = dayNum > 0 && dayNum <= days;
     const dateStr = isCurrentMonth ? formatCalDate(currentMonth.getFullYear(), currentMonth.getMonth() + 1, dayNum) : null;
     currentWeek.push({ dayNum, isCurrentMonth, dateStr, index: i % 7 });
     if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }

  return (
    <div className="flex flex-col min-h-full pb-8">
      <div className="flex justify-between items-center mb-6 flex-shrink-0 sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-md z-20 py-2">
        <button onClick={prevMonth} className="p-2 hover:bg-white rounded-xl shadow-sm border border-zinc-200/60 transition-all text-zinc-600 hover:text-zinc-900">&lt;</button>
        <h3 className="font-bold tracking-tight text-xl text-zinc-900">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={nextMonth} className="p-2 hover:bg-white rounded-xl shadow-sm border border-zinc-200/60 transition-all text-zinc-600 hover:text-zinc-900">&gt;</button>
      </div>
      
      <div className="bg-zinc-200/50 border border-zinc-200/60 rounded-2xl overflow-hidden flex flex-col flex-1 shadow-sm">
        <div className="grid grid-cols-7 gap-px bg-zinc-200/50 shrink-0">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="bg-zinc-50 p-2.5 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{d}</div>)}
        </div>
        
        {weeks.map((week, wIdx) => {
           const activeTasks = [];
           tasks.forEach(t => {
              const taskStart = t.startDate;
              const taskEnd = t.endDate;
              const weekStart = week.find(d => d.isCurrentMonth)?.dateStr || '9999-99-99';
              const weekEnd = [...week].reverse().find(d => d.isCurrentMonth)?.dateStr || '0000-00-00';
              if (taskStart <= weekEnd && taskEnd >= weekStart) {
                 activeTasks.push({ ...t, startIdx: week.findIndex(d => d.dateStr >= taskStart || d.dateStr === weekStart), endIdx: week.findLastIndex(d => d.dateStr <= taskEnd || d.dateStr === weekEnd) });
              }
           });
           
           activeTasks.sort((a, b) => (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx));
           const rowSlots = [];
           activeTasks.forEach(task => {
              let slot = 0;
              while (rowSlots[slot] && rowSlots[slot].some(t => !(task.endIdx < t.startIdx || task.startIdx > t.endIdx))) slot++;
              if (!rowSlots[slot]) rowSlots[slot] = [];
              rowSlots[slot].push(task);
           });

           return (
              <div key={wIdx} className="grid grid-cols-7 gap-px bg-zinc-200/50 flex-1 min-h-[110px] relative">
                 {week.map((day, dIdx) => (
                    <div key={dIdx} className={`p-1.5 ${day.isCurrentMonth ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                       {day.isCurrentMonth && <span className="text-xs font-bold text-zinc-400 m-1">{day.dayNum}</span>}
                    </div>
                 ))}
                 
                 <div className="absolute inset-0 pt-7 pointer-events-none">
                    {rowSlots.map((row, rIdx) => (
                       <div key={rIdx} className="relative h-6 mb-1.5">
                          {row.map(task => {
                             const leftPct = (task.startIdx / 7) * 100;
                             const widthPct = ((task.endIdx - task.startIdx + 1) / 7) * 100;
                             return (
                                <div 
                                  key={task.id} onClick={() => onTaskClick(task)}
                                  className="absolute h-5 rounded-[4px] text-[10px] font-semibold text-white px-2 truncate cursor-pointer shadow-sm pointer-events-auto flex items-center hover:ring-2 hover:ring-zinc-900/20 transition-all hover:scale-[1.01] hover:z-10"
                                  style={{ left: `calc(${leftPct}% + 5px)`, width: `calc(${widthPct}% - 10px)`, backgroundColor: task.color }}
                                  title={`${task.name} - Click to Edit`}
                                >
                                  {task.name}
                                </div>
                             )
                          })}
                       </div>
                    ))}
                 </div>
              </div>
           );
        })}
      </div>
    </div>
  );
}
