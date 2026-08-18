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
    part.match(urlRegex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{part}</a> : part
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
    // Removed the auth dependency so it pulls your imported data down immediately!
    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
      setTasks(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, color: data.color || getTaskColor(d.id) };
      }));
      setIsSynced(true);
    }, (err) => console.error("Tasks sync error:", err));
    
    const unsubTeam = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'team'), (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Team sync error:", err));
    
    return () => { unsubTasks(); unsubTeam(); };
  }, []);

  useEffect(() => {
    // 100% Bulletproof Styling Engine Injection
    if (!document.getElementById('tailwind-script')) {
      const twScript = document.createElement('script');
      twScript.id = 'tailwind-script';
      twScript.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(twScript);
    }

    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(script);
    }
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">Flowers for Mary 2027</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></span> {isSynced ? 'Live Synced' : 'Syncing...'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {userRole.role === 'guest' ? (
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition">
              <LogIn size={16} /> Login
            </button>
          ) : (
            <>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100 flex items-center gap-2">
                <User size={14}/> {userRole.username} ({userRole.role})
              </span>
              <button onClick={() => { setPasswordTargetUser(userRole.username); setShowPasswordModal(true); }} className="text-slate-400 hover:text-indigo-600 transition" title="Change My Password">
                <Key size={16}/>
              </button>
              
              {userRole.role === 'manager' && (
                <>
                  <button onClick={() => setShowTeamModal(true)} className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                    <Users size={16} /> Users
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition" title="Export Backup JSON">
                    <Download size={16} /> Export
                  </button>
                  <label className="flex items-center gap-2 px-3 py-2 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer" title="Import Backup JSON">
                    <Upload size={16} /> Import
                    <input type="file" onChange={handleImport} accept="application/json,.json" className="hidden" />
                  </label>
                </>
              )}
              
              <button onClick={generatePDF} className="flex items-center gap-2 px-3 py-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition">
                <FileText size={16} /> Report
              </button>
              
              {userRole.role !== 'viewer' && (
                <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm">
                  <Plus size={16} /> New Task
                </button>
              )}
              
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-600 transition" title="Logout">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div id="report-content" className="max-w-6xl mx-auto space-y-6">
        {/* SCHEDULE VIEW */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarIcon size={18} className="text-indigo-500"/> Project Schedule</h2>
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button onClick={() => setView('timeline')} className={`px-4 py-1.5 text-sm rounded-md transition ${view === 'timeline' ? 'bg-white shadow-sm font-medium text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Timeline</button>
              <button onClick={() => setView('calendar')} className={`px-4 py-1.5 text-sm rounded-md transition ${view === 'calendar' ? 'bg-white shadow-sm font-medium text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Calendar</button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-auto bg-slate-50 p-4" style={{ height: '400px' }}>
            {view === 'timeline' ? (
              <Timeline tasks={tasks} onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} />
            ) : (
              <Calendar tasks={tasks} onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} />
            )}
          </div>
        </div>

        {/* TASK LIST */}
        <div>
           <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Clock size={18} className="text-indigo-500"/> Task Subgroups</h2>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {subgroups.map(sg => {
                const sgTasks = tasks.filter(t => t.subgroup === sg);
                const avgProgress = sgTasks.length ? Math.round(sgTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / sgTasks.length) : 0;
                
                return (
                  <div key={sg} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">{sg}</h3>
                        <span className="text-sm font-medium px-2 py-1 bg-slate-100 rounded-md text-slate-600">{avgProgress}% Done</span>
                     </div>
                     <div className="w-full bg-slate-100 h-2 rounded-full mb-5 overflow-hidden">
                        <div className="bg-indigo-500 h-full transition-all duration-500" style={{width: `${avgProgress}%`}}></div>
                     </div>
                     <div className="space-y-3">
                        {sgTasks.map(task => (
                           <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition group relative">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }}></div>
                                  <span className="font-medium text-sm text-slate-800">{task.name}</span>
                                </div>
                                {canEditTask(task) && (
                                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                     <button onClick={() => { setEditingTask(task); setShowTaskModal(true); }} className="text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>
                                     {userRole.role === 'manager' && <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>}
                                   </div>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-xs text-slate-500 mb-3">
                                 <span className="flex items-center gap-1"><User size={12}/> {task.assignee}</span>
                                 <span>{formatDate(task.startDate)} - {formatDate(task.endDate)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                 <input 
                                   type="range" min="0" max="100" 
                                   value={task.progress || 0} disabled={!canEditTask(task)}
                                   onChange={(e) => updateProgress(task.id, e.target.value)}
                                   className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                                   style={{ background: `linear-gradient(to right, ${task.color} ${task.progress}%, #e2e8f0 ${task.progress}%)`}}
                                 />
                                 <span className="text-xs font-medium w-8 text-right">{task.progress || 0}%</span>
                              </div>
                              
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <details className="group/details" open={task.comments?.length > 0}>
                                  <summary className={`text-xs cursor-pointer flex items-center gap-1 transition ${task.comments?.length > 0 ? 'font-bold text-red-600' : 'font-medium text-slate-500 hover:text-indigo-600'}`}>
                                    <MessageSquare size={12}/> {task.comments?.length || 0} Comments
                                  </summary>
                                  <div className="mt-2 space-y-2">
                                    <CommentThread comments={task.comments || []} taskId={task.id} userRole={userRole} db={db} appId={appId} tasks={tasks} showAlert={showAlert} />
                                    {userRole.role !== 'guest' && (
                                      <form onSubmit={(e) => { e.preventDefault(); addComment(task.id, e.target.elements.comment.value); e.target.reset(); }} className="flex gap-2 mt-2">
                                        <input name="comment" type="text" placeholder="Add a comment..." className="flex-1 text-xs p-2 border border-slate-200 rounded focus:outline-none focus:border-indigo-500" required/>
                                        <button type="submit" className="px-3 py-1 bg-slate-800 text-white text-xs rounded hover:bg-slate-700">Post</button>
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
                <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                  No tasks or subgroups created yet.
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
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className={`text-xl font-bold mb-2 ${alertConfig.isError ? 'text-red-600' : 'text-slate-800'}`}>{alertConfig.title}</h2>
            <p className="text-slate-600 mb-6">{alertConfig.message}</p>
            <div className="flex justify-end gap-2">
              {alertConfig.onConfirm && <button onClick={() => setAlertConfig(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>}
              <button 
                onClick={() => { if (alertConfig.onConfirm) alertConfig.onConfirm(); setAlertConfig(null); }} 
                className={`px-4 py-2 text-white rounded-lg transition ${alertConfig.isError ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {alertConfig.onConfirm ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Set Password for {passwordTargetUser}</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"} autoFocus required value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10" 
                  placeholder="New password..." 
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showNewPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Login</h2>
            {loginError && <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded flex items-center gap-2"><AlertCircle size={14}/>{loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input type="text" autoFocus required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Andres or Don" />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type={showLoginPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10" />
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-8 text-slate-400 hover:text-slate-600">
                  {showLoginPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowLogin(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Manage Users</h2>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
              <div className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200 rounded">
                <div className="flex flex-col">
                   <span className="font-medium">Andres</span>
                   <span className="text-[10px] text-slate-500 uppercase">Manager</span>
                </div>
                <button onClick={() => { setPasswordTargetUser('Andres'); setShowPasswordModal(true); }} className="text-amber-500 hover:text-amber-700 p-1" title="Set Custom Password"><Key size={16}/></button>
              </div>
              {team.map(member => (
                editingUserId === member.id ? (
                  <div key={member.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded shadow-sm">
                    <input autoFocus value={editUserName} onChange={e => setEditUserName(e.target.value)} className="flex-1 p-1 text-sm border border-indigo-300 rounded outline-none focus:ring-2 focus:ring-indigo-200" />
                    <button onClick={() => editTeamMember(member, editUserName)} className="text-green-600 hover:text-green-700 bg-green-50 p-1 rounded"><Check size={16}/></button>
                    <button onClick={() => setEditingUserId(null)} className="text-slate-500 hover:text-slate-700 bg-slate-100 p-1 rounded"><X size={16}/></button>
                  </div>
                ) : (
                  <div key={member.id} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded hover:border-slate-300 transition">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{member.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{member.role || 'staff'}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => { setEditingUserId(member.id); setEditUserName(member.name); }} className="text-blue-500 hover:text-blue-700 p-1 transition" title="Edit Username"><Edit2 size={16}/></button>
                      <button onClick={() => { setPasswordTargetUser(member.name); setShowPasswordModal(true); }} className="text-amber-500 hover:text-amber-700 p-1 transition" title="Set Custom Password"><Key size={16}/></button>
                      <button onClick={() => removeTeamMember(member)} className="text-red-400 hover:text-red-600 p-1 transition" title="Delete User"><Trash2 size={16}/></button>
                    </div>
                  </div>
                )
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); const t = e.target; addTeamMember(t.name.value, t.role.value); t.reset(); }} className="flex gap-2 p-3 bg-slate-50 rounded border border-slate-200">
              <input name="name" type="text" placeholder="New user name..." className="flex-1 p-2 text-sm border border-slate-300 rounded outline-none focus:border-indigo-500" required />
              <select name="role" className="p-2 text-sm border border-slate-300 rounded outline-none bg-white">
                 <option value="staff">Staff</option>
                 <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="px-3 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700">Add</button>
            </form>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowTeamModal(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Close</button>
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
    <div className={`space-y-2 ${parentIds.length > 0 ? 'ml-4 pl-3 border-l-2 border-slate-100' : ''}`}>
      {comments.map((c) => {
        const canEdit = userRole.role === 'manager' || userRole.username === c.author;
        return (
          <div key={c.id}>
            <div className="bg-white p-2 rounded border border-slate-100 text-xs group/comment relative hover:border-slate-200 transition">
              <div className="flex justify-between items-start">
                <div className="font-bold text-slate-700">{c.author} <span className="text-slate-400 font-normal ml-1">{new Date(c.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span></div>
                {canEdit && editingCommentId !== c.id && (
                  <div className="flex gap-1 opacity-0 group-hover/comment:opacity-100 transition absolute right-2 top-2 bg-white pl-2">
                    <button onClick={() => setReplyingToId(c.id)} className="text-slate-400 hover:text-blue-500" title="Reply"><Reply size={13}/></button>
                    <button onClick={() => setEditingCommentId(c.id)} className="text-slate-400 hover:text-indigo-600" title="Edit"><Edit2 size={13}/></button>
                    <button onClick={() => deleteComment(c.id)} className="text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={13}/></button>
                  </div>
                )}
                {!canEdit && userRole.role !== 'guest' && (
                  <div className="opacity-0 group-hover/comment:opacity-100 transition absolute right-2 top-2 bg-white pl-2">
                     <button onClick={() => setReplyingToId(c.id)} className="text-slate-400 hover:text-blue-500" title="Reply"><Reply size={13}/></button>
                  </div>
                )}
              </div>
              
              {editingCommentId === c.id ? (
                <form onSubmit={e => { e.preventDefault(); saveEdit(c.id, e.target.elements.txt.value); }} className="mt-2 flex gap-1">
                  <input name="txt" defaultValue={c.text} autoFocus className="flex-1 p-1 border border-slate-300 rounded text-xs outline-none focus:border-indigo-500"/>
                  <button type="submit" className="px-2 bg-indigo-600 text-white rounded"><Check size={12}/></button>
                  <button type="button" onClick={() => setEditingCommentId(null)} className="px-2 bg-slate-200 text-slate-700 rounded"><X size={12}/></button>
                </form>
              ) : (
                <div className="text-slate-600 mt-1 break-words">{urlify(c.text)}</div>
              )}
            </div>
            
            {replyingToId === c.id && (
              <form onSubmit={e => { e.preventDefault(); addReply(c.id, e.target.elements.replyTxt.value); }} className="mt-1 flex gap-1 ml-4 pl-3 border-l-2 border-blue-200">
                  <input name="replyTxt" placeholder="Write a reply..." autoFocus className="flex-1 p-1.5 border border-blue-300 rounded text-xs outline-none focus:border-blue-500 bg-blue-50"/>
                  <button type="submit" className="px-2 bg-blue-600 text-white rounded text-xs">Reply</button>
                  <button type="button" onClick={() => setReplyingToId(null)} className="px-2 bg-slate-200 text-slate-700 rounded"><X size={12}/></button>
              </form>
            )}

            {c.replies && c.replies.length > 0 && (
              <div className="mt-1">
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
  const [color, setColor] = useState(task?.color || '#3b82f6');

  const presetColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#0f172a'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (startDate > endDate) return alert("End Date must be after Start Date!");
    const finalSubgroup = subgroupMode === 'new' ? subgroupNew : subgroupSelect;
    if (!finalSubgroup.trim()) return alert("Subgroup is required.");
    onSave({ ...task, name, subgroup: finalSubgroup, assignee, startDate, endDate, color });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subgroup</label>
            <select value={subgroupMode === 'new' ? 'NEW' : subgroupSelect} onChange={e => { if(e.target.value === 'NEW') setSubgroupMode('new'); else { setSubgroupMode('existing'); setSubgroupSelect(e.target.value); } }} className="w-full p-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none mb-2">
              {subgroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
              <option value="NEW">+ Create New Subgroup...</option>
            </select>
            {subgroupMode === 'new' && <input type="text" required placeholder="Type new subgroup name..." value={subgroupNew} onChange={e => setSubgroupNew(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none" />}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg outline-none">
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" required value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className="w-full p-2 border border-slate-300 rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg outline-none" />
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-100">
             <label className="block text-sm font-medium text-slate-700 mb-2">Task Color</label>
             <div className="flex flex-wrap gap-2 mb-2">
                {presetColors.map(c => (
                   <button key={c} type="button" onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:scale-110'}`} style={{backgroundColor: c}}></button>
                ))}
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Custom mix:</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
             </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Task</button>
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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] flex flex-col items-end">
       {/* Chat Window */}
       {isOpen && (
          <div className="bg-white sm:border border-slate-200 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fixed inset-0 sm:relative sm:inset-auto w-full h-full sm:w-80 sm:h-[500px] sm:mb-4 z-[70]">
            {!activeChannel ? (
               /* LOBBY VIEW */
               <div className="flex flex-col h-full">
                 <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),16px)] sm:pt-4">
                    <h3 className="font-bold">Chat</h3>
                    <div className="flex gap-2">
                       <button onClick={() => setShowCreate(!showCreate)} className="p-1 hover:bg-indigo-500 rounded"><PlusCircle size={18}/></button>
                       <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-500 rounded"><X size={18}/></button>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-slate-50 p-2 space-y-1">
                    {showCreate && (
                       <div className="bg-white p-3 rounded-lg border border-indigo-200 mb-4 shadow-sm">
                          <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">New Conversation</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
                             {everyoneElse.map(u => (
                                <label key={u} className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer">
                                   <input type="checkbox" checked={selectedUsers.includes(u)} onChange={e => {
                                      if (e.target.checked) setSelectedUsers([...selectedUsers, u]);
                                      else setSelectedUsers(selectedUsers.filter(x => x !== u));
                                   }}/>
                                   {u}
                                </label>
                             ))}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => setShowCreate(false)} className="flex-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">Cancel</button>
                             <button onClick={createChannel} disabled={selectedUsers.length===0} className="flex-1 px-2 py-1 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Start</button>
                          </div>
                       </div>
                    )}

                    <div className="text-xs font-bold text-slate-400 uppercase px-2 pt-2 pb-1">Channels</div>
                    {channels.map(ch => {
                       const isGeneral = ch.id === 'general';
                       const name = isGeneral ? 'Team Chat' : ch.participants.filter(p => p !== userRole.username).join(', ');
                       const unread = unreadCounts[ch.id] || 0;
                       
                       return (
                          <button key={ch.id} onClick={() => handleOpenChannel(ch)} className="w-full flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition text-left">
                             <div className="flex items-center gap-3 truncate pr-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isGeneral ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                   {isGeneral ? <Users size={16}/> : <User size={16}/>}
                                </div>
                                <span className="font-medium text-slate-800 truncate">{name}</span>
                             </div>
                             {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unread}</span>}
                          </button>
                       )
                    })}
                 </div>
                 
                 <div className="p-3 border-t border-slate-200 bg-white shrink-0 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-3">
                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Online Now</div>
                    <div className="flex flex-wrap gap-2">
                       {Object.keys(onlineUsers).map(u => (
                          <span key={u} className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>{u}
                          </span>
                       ))}
                    </div>
                 </div>
               </div>
            ) : (
               /* ROOM VIEW */
               <div className="flex flex-col h-full">
                  <div className="bg-indigo-600 p-3 text-white flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),16px)] sm:pt-3">
                     <div className="flex items-center gap-2 truncate">
                        <button onClick={() => { setActiveChannel(null); markRead(activeChannel.id); }} className="p-1 hover:bg-indigo-500 rounded"><ArrowLeft size={16}/></button>
                        <span className="font-bold truncate">{activeChannel.id === 'general' ? 'Team Chat' : activeChannel.participants.filter(p => p !== userRole.username).join(', ')}</span>
                     </div>
                     <div className="flex items-center gap-1 shrink-0 ml-2">
                        {activeChannel.id !== 'general' && userRole.role === 'manager' && (
                           <button onClick={deleteChannel} className="p-1 hover:text-red-300 transition" title="Delete Chat"><Trash2 size={16}/></button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-500 rounded"><X size={18}/></button>
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                     {messages.length === 0 && <div className="text-center text-slate-400 text-sm mt-10">Start the conversation!</div>}
                     {messages.map(m => {
                        const isMe = m.author === userRole.username;
                        return (
                           <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-slate-400 mb-1 px-1">{m.author}</span>
                              <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm break-words ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                 {urlify(m.text)}
                              </div>
                           </div>
                        )
                     })}
                     <div ref={messagesEndRef} />
                  </div>
                  
                  <form onSubmit={sendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-3">
                     <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 border border-slate-300 rounded-full text-sm outline-none focus:border-indigo-500" />
                     <button type="submit" disabled={!newMessage.trim()} className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 shrink-0"><Send size={16} className="ml-1"/></button>
                  </form>
               </div>
            )}
          </div>
       )}

       {/* Chat Button (Hidden on Mobile when Chat is Open) */}
       <button onClick={handleToggleChat} className={`w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl items-center justify-center hover:bg-indigo-700 transition relative outline-none focus:ring-4 focus:ring-indigo-300 ${isOpen ? 'hidden sm:flex' : 'flex'}`}>
          <MessageSquare size={24} />
          {totalUnread > 0 && !isOpen && (
             <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">{totalUnread}</span>
          )}
       </button>
    </div>
  );
}

function Timeline({ tasks, onTaskClick }) {
  if (!tasks.length) return <div className="h-full flex items-center justify-center text-slate-400">No tasks to display</div>;
  
  const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
  const minDate = new Date(Math.min(...allDates));
  minDate.setDate(minDate.getDate() - 7);
  const maxDate = new Date(Math.max(...allDates));
  maxDate.setDate(maxDate.getDate() + 14);
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const dayWidth = 40; 

  return (
    <div className="relative min-w-max min-h-full pb-8">
      <div className="flex sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = new Date(minDate);
          d.setDate(d.getDate() + i);
          const isFirstOfMonth = d.getDate() === 1;
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={i} className={`flex-shrink-0 border-r border-slate-200 flex flex-col items-center justify-end pb-1 ${isToday ? 'bg-indigo-50 font-bold text-indigo-600' : ''}`} style={{ width: dayWidth }}>
              {isFirstOfMonth && <span className="absolute top-1 text-xs font-bold text-slate-800 whitespace-nowrap ml-1">{d.toLocaleString('default', { month: 'short' })}</span>}
              <span className="text-[10px] text-slate-500 mt-5">{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      
      <div className="pt-4 space-y-3 relative">
        {tasks.map(task => {
          const start = new Date(task.startDate);
          const end = new Date(task.endDate);
          const leftDays = Math.floor((start - minDate) / (1000 * 60 * 60 * 24));
          const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          
          return (
             <div key={task.id} className="relative h-8 group" style={{ width: totalDays * dayWidth }}>
                <div 
                  onClick={() => onTaskClick(task)}
                  className="absolute h-6 top-1 rounded-md shadow-sm border overflow-hidden transition-all hover:ring-2 hover:ring-indigo-400 z-10 cursor-pointer"
                  style={{ 
                    left: leftDays * dayWidth, width: Math.max(durationDays * dayWidth, 10),
                    backgroundColor: `${task.color}20`, borderColor: task.color
                  }}
                  title={`${task.name} (${task.progress || 0}%) - Click to Edit`}
                >
                  <div className="h-full opacity-60" style={{ width: `${task.progress || 0}%`, backgroundColor: task.color }}></div>
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-slate-800 truncate" style={{textShadow: '0 0 2px white'}}>{task.name}</span>
                </div>
             </div>
          );
        })}
        <div className="absolute top-0 bottom-0 border-l-2 border-indigo-500 z-0 opacity-50 pointer-events-none" style={{ left: Math.floor((new Date() - minDate) / (1000 * 60 * 60 * 24)) * dayWidth + (dayWidth/2) }}></div>
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
      <div className="flex justify-between items-center mb-4 flex-shrink-0 sticky top-0 bg-slate-50 z-20 py-2">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded">&lt;</button>
        <h3 className="font-bold text-lg">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded">&gt;</button>
      </div>
      
      <div className="bg-slate-200 border border-slate-200 rounded-lg overflow-hidden flex flex-col flex-1">
        <div className="grid grid-cols-7 gap-px bg-slate-200 shrink-0">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="bg-slate-100 p-2 text-center text-xs font-bold text-slate-600 uppercase">{d}</div>)}
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
              <div key={wIdx} className="grid grid-cols-7 gap-px bg-slate-200 flex-1 min-h-[100px] relative">
                 {week.map((day, dIdx) => (
                    <div key={dIdx} className={`p-1 ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50'}`}>
                       {day.isCurrentMonth && <span className="text-xs font-medium text-slate-400 m-1">{day.dayNum}</span>}
                    </div>
                 ))}
                 
                 <div className="absolute inset-0 pt-6 pointer-events-none">
                    {rowSlots.map((row, rIdx) => (
                       <div key={rIdx} className="relative h-6 mb-1">
                          {row.map(task => {
                             const leftPct = (task.startIdx / 7) * 100;
                             const widthPct = ((task.endIdx - task.startIdx + 1) / 7) * 100;
                             return (
                                <div 
                                  key={task.id} onClick={() => onTaskClick(task)}
                                  className="absolute h-5 rounded-md text-[10px] font-medium text-white px-2 truncate cursor-pointer shadow-sm pointer-events-auto flex items-center hover:ring-2 hover:ring-white transition"
                                  style={{ left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)`, backgroundColor: task.color }}
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