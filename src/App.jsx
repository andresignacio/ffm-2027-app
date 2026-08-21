import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar as CalendarIcon, Clock, Users, User, LogIn, LogOut, Plus, Download, Upload, FileText, MessageSquare, Trash2, Edit2, AlertCircle, Key, Eye, EyeOff, X, Check, ArrowLeft, Send, Reply, TrendingUp, Smile } from 'lucide-react';

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

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

const getTaskColor = (id) => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#6366f1', '#a855f7', '#ec4899', '#fb923c'];
  let hash = 0;
  if (!id) return colors[0];
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
};

const urlify = (text) => {
  if (typeof text !== 'string') return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => 
    part.match(urlRegex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-700 font-semibold hover:underline transition-colors">{part}</a> : part
  );
};

// Lightweight, dependency-free Markdown-ish renderer for chat/comments.
// Supported: **bold**, *italic*, _italic_, <u>underline</u>, ~~strike~~,
// `inline code`, [label](https://...), bullet/numbered lists, blockquotes,
// and plain URLs. HTML tags other than the explicit underline syntax are treated as text.
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Legacy Markdown renderer -> safe HTML string for backward compatibility with
// comments/messages that were saved before the rich-text editor was introduced.
const markdownToHtml = (text) => {
  const lines = String(text ?? '').split('\n');
  const out = [];
  let listType = null;
  let listItems = [];

  const inline = (source) => {
    let html = escapeHtml(source);

    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_\n]+)__/g, '<u>$1</u>');
    html = html.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    html = html.replace(/&lt;u&gt;([^&\n]+)&lt;\/u&gt;/gi, '<u>$1</u>');
    return html;
  };

  const flush = () => {
    if (!listType) return;
    out.push(`<${listType}>${listItems.map(item => `<li>${inline(item)}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  };

  lines.forEach(line => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);

    if (bullet || numbered) {
      const desired = bullet ? 'ul' : 'ol';
      if (listType && listType !== desired) flush();
      if (!listType) listType = desired;
      listItems.push((bullet || numbered)[1]);
      return;
    }

    flush();
    if (quote) {
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
    } else if (line.trim() === '') {
      out.push('<div><br></div>');
    } else {
      out.push(`<div>${inline(line)}</div>`);
    }
  });

  flush();
  return out.join('');
};

const sanitizeHtml = (html) => {
  if (typeof document === 'undefined') return escapeHtml(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html ?? ''), 'text/html');
  const allowedTags = new Set(['DIV','P','BR','STRONG','B','EM','I','U','S','DEL','CODE','UL','OL','LI','BLOCKQUOTE','A']);
  const allowedAttrs = {
    A: new Set(['href','target','rel'])
  };

  const walk = (node) => {
    [...node.children].forEach(child => {
      if (!allowedTags.has(child.tagName)) {
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        return;
      }

      [...child.attributes].forEach(attr => {
        const keep = allowedAttrs[child.tagName]?.has(attr.name);
        if (!keep) child.removeAttribute(attr.name);
      });

      if (child.tagName === 'A') {
        const href = child.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) child.removeAttribute('href');
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }

      walk(child);
    });
  };

  walk(doc.body);
  return doc.body.innerHTML;
};

const renderFormattedText = (text) => {
  if (typeof text !== 'string') return null;
  const hasRichHtml = /<(strong|b|em|i|u|s|del|code|ul|ol|li|blockquote|a|br|div|p)\b/i.test(text);

  if (hasRichHtml) {
    return (
      <div
        className="break-words leading-relaxed [&_a]:text-violet-600 [&_a]:font-semibold [&_a]:hover:underline [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-zinc-100 [&_code]:rounded [&_code]:font-mono [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 [&_blockquote]:italic"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }

  const html = markdownToHtml(text);
  return (
    <div
      className="break-words leading-relaxed [&_a]:text-violet-600 [&_a]:font-semibold [&_a]:hover:underline [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-zinc-100 [&_code]:rounded [&_code]:font-mono [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 [&_blockquote]:italic"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
};

function RichTextComposer({
  placeholder,
  onSubmit,
  submitLabel = 'Post',
  cancelLabel = null,
  onCancel = null,
  autoFocus = false,
  accent = 'zinc',
  compact = false,
  initialValue = '',
}) {
  const [html, setHtml] = useState(() => {
    const initial = initialValue || '';
    return /<(strong|b|em|i|u|s|del|code|ul|ol|li|blockquote|a|br|div|p)\b/i.test(initial)
      ? initial
      : markdownToHtml(initial);
  });
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const initial = initialValue || '';
    const nextHtml = /<(strong|b|em|i|u|s|del|code|ul|ol|li|blockquote|a|br|div|p)\b/i.test(initial)
      ? sanitizeHtml(initial)
      : markdownToHtml(initial);
    setHtml(nextHtml);
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
    initializedRef.current = true;
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      const frame = requestAnimationFrame(() => {
        editorRef.current?.focus();
        setIsFocused(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [autoFocus]);

  const focusEditor = () => editorRef.current?.focus();

  const applyCommand = (command, value = null) => {
    focusEditor();
    try {
      document.execCommand(command, false, value);
      setHtml(editorRef.current?.innerHTML || '');
    } catch (err) {
      console.warn('Formatting command failed:', command, err);
    }
  };

  const insertLink = () => {
    focusEditor();
    const url = window.prompt('Enter URL');
    if (!url) return;
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      document.execCommand('createLink', false, safeUrl);
      setHtml(editorRef.current?.innerHTML || '');
    } catch (err) {
      console.warn('Link insertion failed:', err);
    }
  };

  const handleInput = (e) => {
    setHtml(e.currentTarget.innerHTML);
  };

  const handleKeyDown = (e) => {
    // Common rich-text shortcuts.
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyCommand('bold');
    } else if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyCommand('italic');
    } else if (mod && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      applyCommand('underline');
    }
  };

  const handlePaste = (e) => {
    // Keep clipboard text only; this avoids importing arbitrary HTML into the editor.
    const text = e.clipboardData?.getData('text/plain');
    if (typeof text === 'string' && text.length > 0) {
      e.preventDefault();
      document.execCommand('insertText', false, text);
      setHtml(editorRef.current?.innerHTML || '');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const currentHtml = editorRef.current?.innerHTML || '';
    const plainText = (editorRef.current?.innerText || '').trim();
    if (!plainText) return;
    onSubmit(sanitizeHtml(currentHtml));
    if (editorRef.current) editorRef.current.innerHTML = '';
    setHtml('');
  };

  const buttonClass = 'min-w-8 px-2 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 text-[11px] font-black transition-colors';
  const plainText = (editorRef.current?.innerText || '').trim();
  const editorHeightClass = compact ? 'min-h-14' : 'min-h-20';
  const submitButtonClass = `px-4 py-2 ${accent === 'violet' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-zinc-900 hover:bg-zinc-800'} text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors`;
  const borderClass = accent === 'violet'
    ? 'border-violet-200 focus-within:border-violet-500 focus-within:ring-violet-500/20'
    : 'border-zinc-200 focus-within:border-violet-500 focus-within:ring-violet-500/20';

  return (
    <form onSubmit={submit} className="w-full">
      <div className={`rounded-2xl border bg-white focus-within:ring-2 ${borderClass} shadow-sm overflow-hidden`}>
        {isFocused && (
          <div className="flex flex-wrap items-center gap-1 px-2 py-2 bg-zinc-50 border-b border-zinc-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mr-1">Format</span>
            <button type="button" className={`${buttonClass} font-black`} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('bold')} title="Bold">B</button>
            <button type="button" className={`${buttonClass} italic`} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('italic')} title="Italic">I</button>
            <button type="button" className={`${buttonClass} underline`} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('underline')} title="Underline">U</button>
            <button type="button" className={`${buttonClass} line-through`} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('strikeThrough')} title="Strikethrough">S</button>
            <button type="button" className={`${buttonClass} font-mono`} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('formatBlock', 'pre')} title="Code block">&lt;/&gt;</button>
            <button type="button" className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('insertUnorderedList')} title="Bulleted list">•</button>
            <button type="button" className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('insertOrderedList')} title="Numbered list">1.</button>
            <button type="button" className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand('formatBlock', 'blockquote')} title="Quote">❝</button>
            <button type="button" className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={insertLink} title="Insert link">🔗</button>
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={`w-full ${editorHeightClass} resize-y overflow-y-auto bg-transparent px-3.5 py-3 text-sm outline-none font-medium text-zinc-800 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 [&_a]:text-violet-600 [&_a]:font-semibold [&_a]:hover:underline [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-zinc-100 [&_code]:rounded [&_code]:font-mono [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 [&_blockquote]:italic`}
        />
      </div>

      <div className="flex justify-end gap-2 mt-2">
        {cancelLabel && onCancel && (
          <button type="button" onClick={onCancel} className="px-3.5 py-2 bg-white text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-xs font-bold transition-colors">
            {cancelLabel}
          </button>
        )}
        <button type="submit" disabled={!plainText} className={submitButtonClass}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const getRecentComments = (comments, count = 2) =>
  [...(comments || [])]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, count);

const renderReactions = (reactions, onToggle, isMe) => {
  if (!reactions) return null;
  const counts = {};
  Object.entries(reactions).forEach(([user, emoji]) => {
     if (!counts[emoji]) counts[emoji] = { count: 0, users: [] };
     counts[emoji].count++;
     counts[emoji].users.push(user);
  });
  if (Object.keys(counts).length === 0) return null;
  return (
     <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
        {Object.entries(counts).map(([emoji, data]) => (
            <button key={emoji} onClick={() => onToggle(emoji)} title={data.users.join(', ')} className="text-[10px] bg-white border border-zinc-200 shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-1 hover:bg-zinc-50 z-10 transition-transform hover:scale-105">
               <span>{emoji}</span><span className="font-bold text-zinc-500">{data.count}</span>
            </button>
        ))}
     </div>
  )
};

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [userRole, setUserRole] = useState({ role: 'guest', username: '' });
  
  // UI State
  const [view, setView] = useState('timeline');
  const [timelineZoom, setTimelineZoom] = useState(44);
  const [showLogin, setShowLogin] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);
  const [undoAction, setUndoAction] = useState(null); // Global Undo State
  const [expandedComments, setExpandedComments] = useState({});

  // Progress Update State
  const [localSlider, setLocalSlider] = useState({});
  const [progressUpdate, setProgressUpdate] = useState(null);

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

  useEffect(() => {
    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { 
        console.warn("Auth setup issue:", e);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setFbUser);
    return unsub;
  }, []);

  // INSTANT FETCH: No fbUser gatekeeper! Guests on Share Links get instant access.
  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), (snap) => {
      setTasks(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, color: data.color || getTaskColor(d.id) };
      }));
      setIsSynced(true);
    }, (err) => console.warn("Tasks sync issue (normal for guests):", err));
    
    const unsubTeam = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'team'), (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn("Team sync issue:", err));
    
    return () => { unsubTasks(); unsubTeam(); };
  }, []); // Run exactly once on mount, regardless of login state!

  useEffect(() => {
    if (undoAction) {
       const timer = setTimeout(() => setUndoAction(null), 7000);
       return () => clearTimeout(timer);
    }
  }, [undoAction]);

  const showAlert = (title, message, isError = false, onConfirm = null) => {
    setAlertConfig({ title, message, isError, onConfirm });
  };

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
      setLoginError('Error verifying credentials. Check internet connection.');
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

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'credentials', passwordTargetUser), {
        password: newPassword,
        role: role
      });
      setShowPasswordModal(false);
      setNewPassword('');
      showAlert('Success', `Password updated successfully for ${passwordTargetUser}.`);
    } catch (err) {
      showAlert('Error', 'Failed to update password. You may not have permission.', true);
    }
  };

  const handleLogout = () => setUserRole({ role: 'guest', username: '' });

  // Team Management Implementations
  const addTeamMember = async (name, role) => {
     if (!name.trim()) return;
     const newId = generateId();
     await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', newId), { id: newId, name: name.trim(), role });
  };
  
  const editTeamMember = async (member, newName) => {
     if (!newName.trim()) return;
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', member.id), { name: newName.trim() });
     setEditingUserId(null);
  };
  
  const removeTeamMember = async (member) => {
     showAlert("Remove User", `Are you sure you want to remove ${member.name}?`, false, async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team', member.id));
     });
  };

  const saveTask = async (taskData) => {
    const id = taskData.id || generateId();
    const task = { ...taskData, id, color: taskData.color || getTaskColor(id) };
    if (!task.progress) task.progress = 0;
    if (!task.comments) task.comments = [];
    if (!task.updates) task.updates = [];
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), task);
      setShowTaskModal(false);
    } catch (err) {
      showAlert("Error", "Could not save task. Check your permissions.", true);
    }
  };

  const deleteTask = async (id) => {
    const taskToRestore = tasks.find(t => t.id === id);
    showAlert("Delete Task", "Are you sure you want to permanently delete this task?", false, async () => {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id));
        setUndoAction({
           message: `Deleted task "${taskToRestore.name}"`,
           action: async () => await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id), taskToRestore)
        });
      } catch (err) {
        showAlert("Error", "Could not delete task.", true);
      }
    });
  };

  const updateTaskDates = async (taskId, startDate, endDate) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !canEditTask(task)) {
      showAlert("Access Denied", "You don't have permission to move this task.", true);
      return false;
    }
    
    if (task.startDate === startDate && task.endDate === endDate) return true;
    
    const originalStart = task.startDate;
    const originalEnd = task.endDate;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { startDate, endDate });
      setUndoAction({
         message: `Rescheduled task "${task.name}"`,
         action: async () => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), { startDate: originalStart, endDate: originalEnd })
      });
      return true;
    } catch (err) {
      showAlert("Error", "Could not save the new task dates. Please try again.", true);
      return false;
    }
  };

  const cancelProgressUpdate = () => {
    setLocalSlider(prev => { const next = {...prev}; delete next[progressUpdate.task.id]; return next; });
    setProgressUpdate(null);
  };

  const confirmProgressUpdate = async (e) => {
    e.preventDefault();
    const note = e.target.elements.note.value.trim();
    const { task, newProgress } = progressUpdate;
    
    try {
      const newAuditUpdate = {
        id: generateId(),
        author: userRole.username,
        text: note,
        from: task.progress || 0,
        to: newProgress,
        timestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', task.id), { 
        progress: newProgress,
        updates: [...(task.updates || []), newAuditUpdate]
      });

      setLocalSlider(prev => { const next = {...prev}; delete next[task.id]; return next; });
      setProgressUpdate(null);
    } catch (err) {
      showAlert("Error", "Failed to save progress update.", true);
    }
  };

  const addComment = async (taskId, text) => {
    if (!text.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    const newComment = { id: generateId(), author: userRole.username, text, timestamp: new Date().toISOString(), replies: [], reactions: {} };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
      comments: [...(task.comments || []), newComment]
    });
  };

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
    e.target.value = null;
  };

  const generatePDF = async () => {
    if (!window.html2pdf) {
       const script = document.createElement('script');
       script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
       document.head.appendChild(script);
       return showAlert("Notice", "Installing PDF Generator. Please try clicking Report again in 5 seconds.");
    }

    // 1. Save scroll position and scroll to top to prevent blank pages!
    const originalScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const element = document.getElementById('report-content');
    
    // 2. Temporarily expand ALL details IN PLACE
    const details = Array.from(element.querySelectorAll('details'));
    const originalDetailsState = details.map(el => el.hasAttribute('open'));
    details.forEach(el => el.setAttribute('open', 'true'));

    // 3. Expand scrollables IN PLACE
    const scrollables = Array.from(element.querySelectorAll('.custom-scrollbar, .overflow-auto, .overflow-y-auto'));
    const originalScrollStyles = scrollables.map(el => ({
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow
    }));
    scrollables.forEach(el => {
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    });

    // 4. Prepend a clean, professional PDF header
    const tsDiv = document.createElement('div');
    tsDiv.id = 'temp-pdf-header';
    const now = new Date();
    tsDiv.innerHTML = `
      <div style="border-bottom: 2px solid #e4e4e7; padding-bottom: 16px; margin-bottom: 32px; padding-top: 10px; padding-left: 10px;">
          <h1 style="color:#18181b; font-family: sans-serif; font-size: 28px; font-weight: 900; margin: 0;">Flowers for Mary <span style="color:#7c3aed;">2027</span></h1>
          <p style="color:#71717a; font-family: sans-serif; font-size: 14px; font-weight: 600; margin-top: 6px;">Status Report Generated: ${now.toLocaleString()}</p>
      </div>`;
    element.prepend(tsDiv);

    const dateStr = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: `Flowers_For_Mary_Report_${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true }, 
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: '.task-card' }
    };

    try {
      await window.html2pdf().set(opt).from(element).save();
    } finally {
      details.forEach((el, i) => {
        if (!originalDetailsState[i]) el.removeAttribute('open');
      });
      scrollables.forEach((el, i) => {
        el.style.height = originalScrollStyles[i].height;
        el.style.maxHeight = originalScrollStyles[i].maxHeight;
        el.style.overflow = originalScrollStyles[i].overflow;
      });
      const tempHeader = document.getElementById('temp-pdf-header');
      if (tempHeader) tempHeader.remove();
      
      window.scrollTo(0, originalScrollY);
    }
  };

  const canEditTask = (task) => userRole.role === 'manager' || (userRole.role === 'staff' && userRole.username === task.assignee);
  const subgroups = [...new Set(tasks.map(t => t.subgroup))];
  const staffAssignees = ["Andres", ...team.filter(t => t.role !== 'viewer').map(t => t.name)];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-4 md:p-8 selection:bg-violet-200 selection:text-violet-900 pb-28">
      <header className="max-w-7xl mx-auto bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-200/50 p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-5 sticky top-4 z-40 transition-all">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Flowers for Mary <span className="text-violet-600 font-bold">2027</span></h1>
          <p className="text-xs font-bold text-zinc-500 flex items-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${isSynced ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 animate-pulse shadow-amber-500/50'}`}></span> {isSynced ? 'Live Synced' : 'Syncing...'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 items-center">
          {userRole.role === 'guest' ? (
            <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 font-bold text-sm">
              <LogIn size={16} /> Login
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-zinc-50/80 px-4 py-2 rounded-2xl border border-zinc-200/50 hover:bg-zinc-100 transition-colors">
                <span className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <div className="bg-violet-100/50 text-violet-700 p-1.5 rounded-xl"><User size={14}/></div>
                  {userRole.username} <span className="text-zinc-400 font-medium text-xs ml-0.5">({userRole.role})</span>
                </span>
                <div className="w-px h-4 bg-zinc-300 mx-1"></div>
                <button onClick={() => { setPasswordTargetUser(userRole.username); setShowPasswordModal(true); }} className="text-zinc-400 hover:text-violet-600 transition-colors" title="Change My Password">
                  <Key size={16}/>
                </button>
              </div>
              
              {userRole.role === 'manager' && (
                <>
                  <button onClick={() => setShowTeamModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-zinc-700 bg-white border border-zinc-200/80 rounded-2xl hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm font-bold text-sm">
                    <Users size={16} className="text-zinc-500" /> Users
                  </button>
                  <div className="flex bg-white border border-zinc-200/80 rounded-2xl shadow-sm p-1 gap-1">
                    <button onClick={handleExport} className="flex items-center justify-center p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors font-semibold text-sm px-3" title="Export Data">
                      <Download size={16} className="mr-1.5" /> Export
                    </button>
                    <div className="w-px bg-zinc-200 my-1"></div>
                    <label className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer font-semibold text-sm px-3" title="Import Data">
                      <Upload size={16} className="mr-1.5" /> Import
                      <input type="file" onChange={handleImport} accept="application/json,.json" className="hidden" />
                    </label>
                  </div>
                </>
              )}
              
              <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2.5 text-zinc-700 bg-white border border-zinc-200/80 rounded-2xl hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm font-bold text-sm">
                <FileText size={16} className="text-zinc-500" /> Report
              </button>
              
              {userRole.role !== 'viewer' && (
                <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 hover:shadow-[0_8px_25px_rgba(124,58,237,0.35)] hover:-translate-y-0.5 transition-all duration-300 font-bold text-sm">
                  <Plus size={16} /> New Task
                </button>
              )}
              
              <button onClick={handleLogout} className="flex items-center justify-center p-2.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all" title="Logout">
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      {}
      <main id="report-content" className="max-w-7xl mx-auto space-y-8">
        <section className="bg-white rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.03)] border border-zinc-200/50 p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl"><CalendarIcon size={20}/></div>
              Project Schedule
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              {view === 'timeline' && (
                <div className="flex items-center gap-3 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-200/60 shadow-sm animate-in fade-in zoom-in duration-200">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Zoom</span>
                  <input 
                    type="range" min="15" max="100" 
                    value={timelineZoom} 
                    onChange={e => setTimelineZoom(Number(e.target.value))} 
                    className="w-24 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                    title="Adjust timeline scale"
                  />
                </div>
              )}
              <div className="flex bg-zinc-50 rounded-2xl p-1.5 border border-zinc-200/60">
                <button onClick={() => setView('timeline')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${view === 'timeline' ? 'bg-white shadow-sm text-zinc-900 border border-zinc-200/50' : 'text-zinc-500 hover:text-zinc-700'}`}>Timeline</button>
                <button onClick={() => setView('calendar')} className={`px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${view === 'calendar' ? 'bg-white shadow-sm text-zinc-900 border border-zinc-200/50' : 'text-zinc-500 hover:text-zinc-700'}`}>Calendar</button>
              </div>
            </div>
          </div>
          <div className="border border-zinc-200/60 rounded-3xl overflow-auto bg-white p-6 shadow-sm relative custom-scrollbar" style={{ height: '460px' }}>
            {view === 'timeline' ? (
              <Timeline 
                tasks={tasks} 
                zoomLevel={timelineZoom} 
                canEditTask={canEditTask} 
                onTaskDateChange={updateTaskDates} 
                onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} 
                onTaskCreate={userRole.role !== 'viewer' && userRole.role !== 'guest' ? (dates) => { setEditingTask({ ...dates, name: '', subgroup: subgroups[0] || 'General' }); setShowTaskModal(true); } : undefined}
              />
            ) : (
              <Calendar 
                tasks={tasks} 
                onTaskClick={(t) => { if(canEditTask(t)) { setEditingTask(t); setShowTaskModal(true); } else { showAlert("Access Denied", "You don't have permission to edit this task."); } }} 
                onTaskCreate={userRole.role !== 'viewer' && userRole.role !== 'guest' ? (dates) => { setEditingTask({ ...dates, name: '', subgroup: subgroups[0] || 'General' }); setShowTaskModal(true); } : undefined}
              />
            )}
          </div>
        </section>

        {}
        <section>
           <div className="flex items-center gap-3 mb-6 px-2">
             <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl"><Clock size={20}/></div>
             <h2 className="text-xl font-bold tracking-tight text-zinc-900">Task Subgroups</h2>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {subgroups.map(sg => {
                const sgTasks = tasks.filter(t => t.subgroup === sg);
                const avgProgress = sgTasks.length ? Math.round(sgTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / sgTasks.length) : 0;
                
                return (
                  <div key={sg} className="bg-white rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.03)] border border-zinc-200/50 p-6 lg:p-8 flex flex-col h-full hover:shadow-[0_15px_50px_rgb(0,0,0,0.06)] transition-all duration-300">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-extrabold text-zinc-900 tracking-tight">{sg}</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 bg-zinc-50 rounded-xl border border-zinc-200/60 text-zinc-600">{avgProgress}% Done</span>
                     </div>
                     <div className="w-full bg-zinc-100 h-2.5 rounded-full mb-8 overflow-hidden">
                        <div className="bg-violet-600 h-full transition-all duration-700 ease-out rounded-full" style={{width: `${avgProgress}%`}}></div>
                     </div>
                     <div className="space-y-4 flex-1">
                        {sgTasks.map(task => {
                           const displayProgress = localSlider[task.id] !== undefined ? localSlider[task.id] : (task.progress || 0);
                           const isChanged = localSlider[task.id] !== undefined && localSlider[task.id] !== (task.progress || 0);
                           const commentsExpanded = !!expandedComments[task.id];
                           const recentComments = getRecentComments(task.comments || [], 2);
                           
                           return (
                             <div key={task.id} className="task-card p-5 bg-zinc-50 rounded-3xl border border-zinc-200/50 hover:bg-white hover:border-violet-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all duration-300 group relative">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: task.color }}></div>
                                    <span className="font-bold text-zinc-900 text-base">{task.name}</span>
                                  </div>
                                  {canEditTask(task) && (
                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-md rounded-xl p-1 border border-zinc-200/60 shadow-sm">
                                       <button onClick={() => { setEditingTask(task); setShowTaskModal(true); }} className="p-2 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                       {userRole.role === 'manager' && <button onClick={() => deleteTask(task.id)} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14}/></button>}
                                     </div>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-zinc-500 mb-5 px-1">
                                   <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-zinc-200/60 shadow-sm"><User size={12} className="text-violet-600"/> {task.assignee}</span>
                                   <span className="text-zinc-400 font-semibold">{formatDate(task.startDate)} - {formatDate(task.endDate)}</span>
                                </div>
                                
                                <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200/60 shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-300">
                                   <input 
                                     type="range" min="0" max="100" step="5"
                                     value={displayProgress} disabled={!canEditTask(task)}
                                     onChange={(e) => setLocalSlider({ ...localSlider, [task.id]: parseInt(e.target.value) })}
                                     className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-zinc-100 accent-violet-600"
                                     style={{ background: `linear-gradient(to right, ${task.color} ${displayProgress}%, #f4f4f5 ${displayProgress}%)`}}
                                   />
                                   
                                   {isChanged ? (
                                      <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200 pl-2 border-l border-zinc-100">
                                         <span className="text-xs font-black text-violet-600 w-9 text-center mr-1">{displayProgress}%</span>
                                         <button onClick={() => setProgressUpdate({ task, newProgress: displayProgress })} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Save Progress"><Check size={14}/></button>
                                         <button onClick={() => setLocalSlider(prev => { const next = {...prev}; delete next[task.id]; return next; })} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Cancel"><X size={14}/></button>
                                      </div>
                                   ) : (
                                      <span className="text-xs font-black text-zinc-700 w-10 text-right">{displayProgress}%</span>
                                   )}
                                </div>
                                
                                <div className="mt-5 pt-4 border-t border-zinc-200/60 space-y-4">
                                  
                                  <details className="group/details" open={task.updates?.length > 0}>
                                    <summary className={`text-xs cursor-pointer flex items-center gap-2 transition-colors select-none ${task.updates?.length > 0 ? 'font-bold text-emerald-600' : 'font-semibold text-zinc-400 hover:text-zinc-600'}`}>
                                      <TrendingUp size={14}/> {task.updates?.length || 0} Progress Updates
                                    </summary>
                                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-emerald-100">
                                      {task.updates?.map(upd => (
                                        <div key={upd.id} className="bg-white p-3 rounded-xl border border-zinc-200/60 shadow-sm text-xs group/upd relative hover:border-zinc-300 transition-all">
                                          <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-zinc-900">{upd.author}</span>
                                            <span className="text-zinc-400 font-medium text-[10px]">{new Date(upd.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                                          </div>
                                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-[10px] mb-1.5 border ${upd.to >= upd.from ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50' : 'bg-rose-50 text-rose-700 border-rose-100/50'}`}>
                                            {upd.from}% <ArrowLeft size={10} className={`rotate-180 ${upd.to < upd.from ? 'text-rose-400' : ''}`}/> {upd.to}%
                                          </div>
                                          <div className="text-zinc-600 break-words leading-relaxed font-medium">{renderFormattedText(upd.text)}</div>
                                        </div>
                                      ))}
                                      {task.updates?.length === 0 && <div className="text-xs text-zinc-400 italic">No progress updates yet.</div>}
                                    </div>
                                  </details>

                                  <div className="mt-5 pt-4 border-t border-zinc-200/60">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className={`text-xs flex items-center gap-2 ${task.comments?.length ? 'font-bold text-violet-600' : 'font-semibold text-zinc-400'}`}>
                                        <MessageSquare size={14}/> {task.comments?.length || 0} Comments
                                      </div>
                                      {task.comments?.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedComments(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                                          className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-violet-600 hover:bg-violet-50 hover:border-violet-200 transition-colors"
                                        >
                                          {commentsExpanded ? 'Collapse' : 'Show All'}
                                        </button>
                                      )}
                                    </div>

                                    <div className="mt-3 space-y-3">
                                      {commentsExpanded ? (
                                        <CommentThread comments={task.comments || []} taskId={task.id} userRole={userRole} db={db} appId={appId} tasks={tasks} showAlert={showAlert} setUndoAction={setUndoAction} />
                                      ) : (
                                        <div className="space-y-2">
                                          {recentComments.map(c => (
                                            <div key={c.id} className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3 py-2.5 text-xs">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-zinc-800">{c.author}</span>
                                                <span className="text-zinc-400 font-medium text-[10px]">{c.timestamp ? new Date(c.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                              </div>
                                              <div className="text-zinc-600 line-clamp-2 leading-relaxed whitespace-pre-wrap">{renderFormattedText(c.text)}</div>
                                            </div>
                                          ))}
                                          {task.comments?.length > 2 && (
                                            <div className="text-[10px] text-zinc-400 italic">Showing the 2 most recent comments.</div>
                                          )}
                                        </div>
                                      )}

                                      {userRole.role !== 'guest' && (
                                        <div className="mt-3">
                                          <RichTextComposer
                                            placeholder="Write a comment..."
                                            submitLabel="Post"
                                            compact
                                            onSubmit={(text) => addComment(task.id, text)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                </div>
                             </div>
                           )
                        })}
                     </div>
                  </div>
                )
              })}
              {subgroups.length === 0 && (
                <div className="col-span-full text-center py-20 text-zinc-400 bg-white rounded-[2rem] border-2 border-dashed border-zinc-200">
                  <div className="mx-auto w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4"><Clock size={24} className="text-zinc-300"/></div>
                  <p className="font-semibold text-zinc-600">No tasks or subgroups created yet.</p>
                  <p className="text-sm mt-1 text-zinc-400">Click "New Task" in the header to get started.</p>
                </div>
              )}
           </div>
        </section>
      </main>

      {}
      {userRole.role !== 'guest' && <ChatPanel db={db} appId={appId} userRole={userRole} team={team} showAlert={showAlert} />}

      {/* Global Undo Toast */}
      {undoAction && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 text-white px-4 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
           <span className="text-sm font-medium">{undoAction.message}</span>
           <button onClick={() => { undoAction.action(); setUndoAction(null); }} className="text-violet-400 font-bold hover:text-violet-300 transition-colors text-sm bg-white/10 px-3 py-1.5 rounded-xl">Undo</button>
           <button onClick={() => setUndoAction(null)} className="text-zinc-400 hover:text-white transition-colors p-1"><X size={14}/></button>
        </div>
      )}

      {/* New Progress Update Modal */}
      {progressUpdate && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border shadow-sm ${progressUpdate.newProgress >= (progressUpdate.task.progress || 0) ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
               <TrendingUp size={22} className={progressUpdate.newProgress >= (progressUpdate.task.progress || 0) ? 'text-emerald-600' : 'text-rose-600'}/>
            </div>
            <h2 className="text-xl font-black tracking-tight mb-2">Update Progress</h2>
            <p className="text-zinc-500 text-sm font-medium mb-6">
              You are {progressUpdate.newProgress >= (progressUpdate.task.progress || 0) ? 'advancing' : 'reverting'} <span className="font-bold text-zinc-800">{progressUpdate.task.name}</span> from {progressUpdate.task.progress || 0}% to <span className={`font-bold ${progressUpdate.newProgress >= (progressUpdate.task.progress || 0) ? 'text-emerald-600' : 'text-rose-600'}`}>{progressUpdate.newProgress}%</span>.
            </p>
            <form onSubmit={confirmProgressUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Reason for update</label>
                <textarea name="note" required autoFocus rows="3" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-medium text-sm resize-none placeholder:text-zinc-400 shadow-sm" placeholder="Briefly describe what changed..." />
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100">
                <button type="button" onClick={cancelProgressUpdate} className="px-5 py-2.5 text-zinc-600 font-bold hover:bg-zinc-50 border border-transparent hover:border-zinc-200 rounded-2xl transition-colors text-sm">Cancel</button>
                <button type="submit" className={`px-6 py-2.5 text-white font-bold rounded-2xl transition-all shadow-md text-sm ${progressUpdate.newProgress >= (progressUpdate.task.progress || 0) ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'}`}>Save Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertConfig && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h2 className={`text-xl font-black tracking-tight mb-3 ${alertConfig.isError ? 'text-rose-600' : 'text-zinc-900'}`}>{alertConfig.title}</h2>
            <p className="text-zinc-600 mb-8 leading-relaxed font-medium text-sm">{alertConfig.message}</p>
            <div className="flex justify-end gap-3">
              {alertConfig.onConfirm && <button onClick={() => setAlertConfig(null)} className="px-5 py-2.5 text-zinc-600 font-bold hover:bg-zinc-50 rounded-2xl transition-colors text-sm border border-transparent hover:border-zinc-200">Cancel</button>}
              <button 
                onClick={() => { if (alertConfig.onConfirm) alertConfig.onConfirm(); setAlertConfig(null); }} 
                className={`px-6 py-2.5 text-white font-bold rounded-2xl transition-all shadow-md text-sm ${alertConfig.isError ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/30'}`}
              >
                {alertConfig.onConfirm ? 'Confirm' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black tracking-tight mb-6">Set Password for {passwordTargetUser}</h2>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"} autoFocus required value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full p-4 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none pr-12 transition-all font-semibold text-sm shadow-sm" 
                  placeholder="New password..." 
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showNewPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-5 py-2.5 text-zinc-600 font-bold hover:bg-zinc-50 rounded-2xl transition-colors text-sm border border-transparent hover:border-zinc-200">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-md shadow-zinc-900/30 text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-sm p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 border border-zinc-200/60 shadow-sm">
               <LogIn size={22} className="text-zinc-800"/>
            </div>
            <h2 className="text-xl font-black tracking-tight mb-2">Welcome back</h2>
            <p className="text-zinc-400 text-xs font-semibold mb-6">Sign in to manage tasks and chat</p>
            {loginError && <div className="mb-6 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2 border border-rose-100"><AlertCircle size={16}/>{loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Username</label>
                <input type="text" autoFocus required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-semibold text-sm shadow-sm" placeholder="e.g. Andres" />
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Password</label>
                <input type={showLoginPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none pr-12 transition-all font-semibold text-sm shadow-sm" placeholder="••••••••"/>
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-10 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showLoginPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100">
                <button type="button" onClick={() => setShowLogin(false)} className="px-5 py-2.5 text-zinc-600 font-bold hover:bg-zinc-50 rounded-2xl transition-colors text-sm border border-transparent hover:border-zinc-200">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-md shadow-zinc-900/30 text-sm">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeamModal && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black tracking-tight mb-6">Manage Team</h2>
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex justify-between items-center p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
                <div className="flex flex-col">
                   <span className="font-bold text-zinc-900">Andres</span>
                   <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest mt-0.5">Manager</span>
                </div>
                <button onClick={() => { setPasswordTargetUser('Andres'); setShowPasswordModal(true); }} className="text-amber-600 hover:text-amber-700 bg-amber-50 p-2.5 rounded-xl transition-colors shadow-sm" title="Set Custom Password"><Key size={16}/></button>
              </div>
              {team.map(member => (
                editingUserId === member.id ? (
                  <div key={member.id} className="flex items-center gap-2 p-3 bg-white border-2 border-violet-500 rounded-2xl shadow-sm">
                    <input autoFocus value={editUserName} onChange={e => setEditUserName(e.target.value)} className="flex-1 p-2 text-sm font-bold border border-zinc-200 rounded-xl outline-none focus:border-violet-500" />
                    <button onClick={() => editTeamMember(member, editUserName)} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 p-2.5 rounded-xl transition-colors"><Check size={16}/></button>
                    <button onClick={() => setEditingUserId(null)} className="text-zinc-500 hover:text-zinc-700 bg-zinc-100 p-2.5 rounded-xl transition-colors"><X size={16}/></button>
                  </div>
                ) : (
                  <div key={member.id} className="flex justify-between items-center p-3.5 bg-white border border-zinc-200/80 rounded-2xl hover:border-zinc-300 hover:shadow-sm transition-all group">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900">{member.name}</span>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{member.role || 'staff'}</span>
                    </div>
                    <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingUserId(member.id); setEditUserName(member.name); }} className="text-blue-600 hover:text-blue-700 bg-blue-50 p-2.5 rounded-xl transition-colors shadow-sm" title="Edit Username"><Edit2 size={14}/></button>
                      <button onClick={() => { setPasswordTargetUser(member.name); setShowPasswordModal(true); }} className="text-amber-600 hover:text-amber-700 bg-amber-50 p-2.5 rounded-xl transition-colors shadow-sm" title="Set Custom Password"><Key size={14}/></button>
                      <button onClick={() => removeTeamMember(member)} className="text-rose-600 hover:text-rose-700 bg-rose-50 p-2.5 rounded-xl transition-colors shadow-sm" title="Delete User"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )
              ))}
            </div>
            
            <div className="pt-6 border-t border-zinc-100">
               <label className="block text-xs font-bold text-zinc-700 mb-2.5 ml-1 uppercase tracking-wider">Add New Member</label>
               <form onSubmit={e => { e.preventDefault(); const t = e.target; addTeamMember(t.name.value, t.role.value); t.reset(); }} className="flex gap-2.5">
                 <input name="name" type="text" placeholder="Name..." className="flex-1 p-3.5 text-sm font-semibold bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm" required />
                 <select name="role" className="p-3.5 text-sm font-semibold bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:bg-white focus:border-violet-500 transition-all cursor-pointer shadow-sm">
                    <option value="staff">Staff</option>
                    <option value="viewer">Viewer</option>
                 </select>
                 <button type="submit" className="px-5 bg-zinc-900 text-white text-sm font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-md shadow-zinc-900/30">Add</button>
               </form>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setShowTeamModal(false)} className="px-6 py-2.5 text-zinc-700 font-bold bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-200 transition-colors text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && <TaskFormModal task={editingTask} onClose={() => setShowTaskModal(false)} onSave={saveTask} subgroups={subgroups} assignees={staffAssignees} />}
    </div>
  );
}

function CommentThread({ comments, taskId, userRole, db, appId, tasks, showAlert, setUndoAction, parentIds = [] }) {
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState(null);

  const performUpdate = async (updatedComments, undoInfo = null) => {
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
    if (undoInfo && setUndoAction) setUndoAction(undoInfo);
  };

  const saveEdit = (id, newText) => {
    const updated = comments.map(c => c.id === id ? { ...c, text: newText } : c);
    performUpdate(updated);
    setEditingCommentId(null);
  };

  const deleteComment = (id) => {
    showAlert("Delete Comment", "Remove this comment?", false, () => {
      const updated = comments.filter(c => c.id !== id);
      const originalComments = [...comments]; // Save for undo
      performUpdate(updated, {
         message: "Comment deleted",
         action: async () => await performUpdate(originalComments)
      });
    });
  };

  const addReply = (parentId, text) => {
    const newReply = { id: generateId(), author: userRole.username, text, timestamp: new Date().toISOString(), replies: [], reactions: {} };
    const updated = comments.map(c => c.id === parentId ? { ...c, replies: [...(c.replies || []), newReply] } : c);
    performUpdate(updated);
    setReplyingToId(null);
  };

  const toggleReaction = (id, emoji) => {
    if (userRole.role === 'guest') return;
    const updated = comments.map(c => {
      if (c.id === id) {
        const newReactions = { ...(c.reactions || {}) };
        if (newReactions[userRole.username] === emoji) {
          delete newReactions[userRole.username];
        } else {
          newReactions[userRole.username] = emoji;
        }
        return { ...c, reactions: newReactions };
      }
      return c;
    });
    performUpdate(updated);
  };

  return (
    <div className={`space-y-3 ${parentIds.length > 0 ? 'ml-5 pl-4 border-l-2 border-zinc-200/60' : ''}`}>
      {comments.map((c) => {
        const canEdit = userRole.role === 'manager' || userRole.username === c.author;
        return (
          <div key={c.id}>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm text-sm group/comment relative hover:border-zinc-300 hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start mb-1.5">
                <div className="font-bold text-zinc-900">{c.author} <span className="text-zinc-400 font-medium text-xs ml-2">{new Date(c.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span></div>
                
                <div className={`flex gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity absolute right-3 top-3 bg-white pl-2 ${reactionPickerId === c.id ? 'opacity-100' : ''}`}>
                  {userRole.role !== 'guest' && (
                     <button onClick={() => setReactionPickerId(reactionPickerId === c.id ? null : c.id)} className="p-1.5 text-zinc-400 hover:text-amber-500 bg-zinc-50 rounded-xl transition-colors" title="React"><Smile size={13}/></button>
                  )}
                  {userRole.role !== 'guest' && !canEdit && (
                     <button onClick={() => setReplyingToId(c.id)} className="p-1.5 text-zinc-400 hover:text-blue-600 bg-zinc-50 rounded-xl transition-colors" title="Reply"><Reply size={13}/></button>
                  )}
                  {canEdit && editingCommentId !== c.id && (
                    <>
                      <button onClick={() => setReplyingToId(c.id)} className="p-1.5 text-zinc-400 hover:text-blue-600 bg-zinc-50 rounded-xl transition-colors" title="Reply"><Reply size={13}/></button>
                      <button onClick={() => setEditingCommentId(c.id)} className="p-1.5 text-zinc-400 hover:text-violet-600 bg-zinc-50 rounded-xl transition-colors" title="Edit"><Edit2 size={13}/></button>
                      <button onClick={() => deleteComment(c.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 bg-zinc-50 rounded-xl transition-colors" title="Delete"><Trash2 size={13}/></button>
                    </>
                  )}
                </div>

                {reactionPickerId === c.id && (
                    <div className="absolute right-3 top-11 bg-white shadow-xl border border-zinc-200 rounded-full px-2 py-1 flex gap-1 z-50 animate-in zoom-in-95 duration-200">
                        {['👍', '❤️', '😂', '😲', '👎'].map(e => (
                            <button key={e} onClick={() => { toggleReaction(c.id, e); setReactionPickerId(null); }} className="hover:scale-125 transition-transform text-base">{e}</button>
                        ))}
                    </div>
                )}
              </div>
              
              {editingCommentId === c.id ? (
                <div className="mt-3">
                  <RichTextComposer
                    placeholder="Edit comment..."
                    submitLabel="Save"
                    cancelLabel="Cancel"
                    onCancel={() => setEditingCommentId(null)}
                    accent="violet"
                    autoFocus
                    initialValue={c.text || ''}
                    onSubmit={(text) => { saveEdit(c.id, text); }}
                  />
                </div>
              ) : (
                <div className="text-zinc-600 mt-1.5 break-words leading-relaxed font-medium whitespace-pre-wrap">{renderFormattedText(c.text)}</div>
              )}

              {renderReactions(c.reactions, (e) => toggleReaction(c.id, e))}
            </div>
            
            {c.replies && c.replies.length > 0 && (
              <div className="mt-3">
                 <CommentThread comments={c.replies} taskId={taskId} userRole={userRole} db={db} appId={appId} tasks={tasks} showAlert={showAlert} setUndoAction={setUndoAction} parentIds={[...parentIds, c.id]} />
              </div>
            )}

            {replyingToId === c.id && (
              <div className="mt-3 ml-5 pl-4 border-l-2 border-violet-300">
                <RichTextComposer
                  placeholder="Write a reply..."
                  submitLabel="Reply"
                  cancelLabel="Cancel"
                  onCancel={() => setReplyingToId(null)}
                  accent="violet"
                  compact
                  autoFocus
                  onSubmit={(text) => addReply(c.id, text)}
                />
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
  const [color, setColor] = useState(task?.color || '#7c3aed');

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const presetColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#7c3aed', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#52525b', '#18181b'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (startDate > endDate) return alert("End Date must be after Start Date!");
    const finalSubgroup = subgroupMode === 'new' ? subgroupNew : subgroupSelect;
    if (!finalSubgroup.trim()) return alert("Subgroup is required.");
    onSave({ ...task, name, subgroup: finalSubgroup, assignee, startDate, endDate, color });
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-zinc-100 w-full max-w-md p-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 custom-scrollbar">
        <h2 className="text-xl font-black tracking-tight mb-6 text-zinc-900">{task && task.id ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Task Name</label>
            <input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-semibold text-sm shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Subgroup</label>
            <select value={subgroupMode === 'new' ? 'NEW' : subgroupSelect} onChange={e => { if(e.target.value === 'NEW') setSubgroupMode('new'); else { setSubgroupMode('existing'); setSubgroupSelect(e.target.value); } }} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-semibold mb-3 cursor-pointer text-sm shadow-sm">
              {subgroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
              <option value="NEW" className="font-bold text-violet-600">+ Create New Subgroup...</option>
            </select>
            {subgroupMode === 'new' && <input type="text" required placeholder="Type new subgroup name..." value={subgroupNew} onChange={e => setSubgroupNew(e.target.value)} className="w-full p-4 bg-white border border-violet-300 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all font-semibold shadow-sm text-sm" />}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Assignee</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:bg-white transition-all font-semibold cursor-pointer text-sm shadow-sm">
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">Start Date</label>
              <input type="date" required value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:bg-white transition-all font-semibold text-sm shadow-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1 uppercase tracking-wider">End Date</label>
              <input type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:bg-white transition-all font-semibold text-sm shadow-sm" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-zinc-100">
             <label className="block text-xs font-bold text-zinc-700 mb-3 ml-1 uppercase tracking-wider">Task Color</label>
             <div className="flex flex-wrap gap-2.5 mb-4">
                {presetColors.map(c => (
                   <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${color === c ? 'border-zinc-900 scale-110 shadow-md' : 'border-transparent hover:scale-110 hover:shadow-sm'}`} style={{backgroundColor: c}}></button>
                ))}
             </div>
             <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-200 w-max shadow-sm">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Custom:</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent" />
             </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-zinc-600 font-bold hover:bg-zinc-50 border border-transparent hover:border-zinc-200 rounded-2xl transition-colors text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2.5 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-md shadow-zinc-900/30 text-sm">Save Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatPanel({ db, appId, userRole, team, showAlert }) {
  const [isOpen, setIsOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [reactionPickerId, setReactionPickerId] = useState(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState(null);
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
    const unsubChannels = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'chatChannels'), (snap) => {
      let chs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      chs = chs.filter(ch => ch.id === 'general' || ch.participants?.includes(userRole.username) || userRole.role === 'manager');
      if (!chs.find(c => c.id === 'general')) chs.unshift({ id: 'general', name: 'Team Chat', participants: [] });
      setChannels(chs);
    });
    return unsubChannels;
  }, [db, appId, userRole]);

  useEffect(() => {
    // Removed orderBy() so it works perfectly without indices on Share Links
    const unsubMessages = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'chatMessages'), (snap) => {
       const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       allMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Sort safely in memory
       
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

  const sendMessage = async (text) => {
    if (!text.trim() || !activeChannel) return;

    const repliedMessage = replyingToMessageId
      ? messages.find(m => m.id === replyingToMessageId)
      : null;

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chatMessages'), {
      channelId: activeChannel.id,
      author: userRole.username,
      text,
      timestamp: Date.now(),
      reactions: {},
      replyTo: repliedMessage ? {
        id: repliedMessage.id,
        author: repliedMessage.author,
        text: repliedMessage.text
      } : null
    });

    setReplyingToMessageId(null);
    markRead(activeChannel.id);
  };

  const toggleChatReaction = async (messageId, emoji, currentReactions = {}) => {
      if (userRole.role === 'guest') return;
      const newReactions = { ...currentReactions };
      if (newReactions[userRole.username] === emoji) {
          delete newReactions[userRole.username];
      } else {
          newReactions[userRole.username] = emoji;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chatMessages', messageId), {
          reactions: newReactions
      });
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

  const filteredUsers = everyoneElse.filter(u => u.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
       {isOpen && (
          <div className="bg-white/95 backdrop-blur-2xl border border-zinc-200/80 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fixed inset-0 sm:relative sm:inset-auto w-full h-full sm:w-[380px] sm:h-[600px] sm:mb-4 z-[70]">
            {!activeChannel ? (
               <div className="flex flex-col h-full">
                 <div className="bg-zinc-900 p-5 text-white flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),20px)] sm:pt-5 border-b border-zinc-800">
                    <h3 className="font-bold tracking-tight text-base flex items-center gap-2.5"><MessageSquare size={18}/> Messages</h3>
                    <div className="flex gap-1.5">
                       <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-xs font-bold"><Plus size={14}/> New</button>
                       <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-xl transition-colors"><X size={18}/></button>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-zinc-50 p-3.5 space-y-2.5 custom-scrollbar">
                    {showCreate && (
                       <div className="bg-white p-4 rounded-2xl border border-zinc-200 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                          <h4 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">New Conversation</h4>
                          
                          {selectedUsers.length > 0 && (
                             <div className="flex flex-wrap gap-1.5 mb-3">
                                {selectedUsers.map(su => (
                                   <span key={su} className="flex items-center gap-1 bg-violet-100 text-violet-700 px-2 py-1 rounded-lg text-xs font-bold">
                                      {su}
                                      <button onClick={() => setSelectedUsers(selectedUsers.filter(x => x !== su))} className="hover:text-violet-900"><X size={12}/></button>
                                   </span>
                                ))}
                             </div>
                          )}

                          <input 
                             type="text" 
                             placeholder="Search team members..." 
                             value={userSearch} 
                             onChange={e => setUserSearch(e.target.value)} 
                             className="w-full p-2.5 mb-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-violet-500 transition-all font-medium"
                          />

                          <div className="space-y-1.5 max-h-40 overflow-y-auto mb-4 custom-scrollbar">
                             {filteredUsers.length === 0 ? (
                                <div className="text-xs text-zinc-400 text-center py-4">No users found.</div>
                             ) : (
                                filteredUsers.map(u => (
                                   <label key={u} className="flex items-center gap-3 text-sm p-2.5 hover:bg-zinc-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-zinc-200 font-semibold text-zinc-700">
                                      <input type="checkbox" checked={selectedUsers.includes(u)} className="rounded text-violet-600 focus:ring-violet-500/20 w-4 h-4" onChange={e => {
                                         if (e.target.checked) setSelectedUsers([...selectedUsers, u]);
                                         else setSelectedUsers(selectedUsers.filter(x => x !== u));
                                      }}/>
                                      {u}
                                   </label>
                                ))
                             )}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => { setShowCreate(false); setUserSearch(''); }} className="flex-1 px-3 py-2.5 bg-zinc-100 text-zinc-600 font-bold rounded-xl text-xs hover:bg-zinc-200 transition-colors">Cancel</button>
                             <button onClick={() => { createChannel(); setUserSearch(''); }} disabled={selectedUsers.length===0} className="flex-1 px-3 py-2.5 bg-zinc-900 text-white font-bold rounded-xl text-xs disabled:opacity-50 hover:bg-zinc-800 transition-colors shadow-sm">Start Chat</button>
                          </div>
                       </div>
                    )}

                    <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest px-2 pt-2 pb-1">Channels</div>
                    {channels.map(ch => {
                       const isGeneral = ch.id === 'general';
                       const name = isGeneral ? 'Team Chat' : ch.participants.filter(p => p !== userRole.username).join(', ');
                       const unread = unreadCounts[ch.id] || 0;
                       
                       return (
                          <button key={ch.id} onClick={() => handleOpenChannel(ch)} className="w-full flex justify-between items-center p-3.5 bg-white rounded-2xl border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-200 text-left group">
                             <div className="flex items-center gap-3 truncate pr-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isGeneral ? 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white' : 'bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white'}`}>
                                   {isGeneral ? <Users size={18}/> : <User size={18}/>}
                                </div>
                                <span className="font-bold text-zinc-800 truncate text-sm">{name}</span>
                             </div>
                             {unread > 0 && <span className="bg-rose-500 shadow-rose-500/30 shadow-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-in zoom-in">{unread}</span>}
                          </button>
                       )
                    })}
                 </div>
                 
                 <div className="p-4 border-t border-zinc-100 bg-white shrink-0 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 rounded-b-[2rem]">
                    <div className="text-[10px] font-extrabold text-zinc-400 mb-2.5 uppercase tracking-widest">Online Now</div>
                    <div className="flex flex-wrap gap-2">
                       {Object.keys(onlineUsers).map(u => (
                          <span key={u} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100/60">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>{u}
                          </span>
                       ))}
                    </div>
                 </div>
               </div>
            ) : (
               <div className="flex flex-col h-full bg-zinc-50">
                  <div className="bg-white p-4 flex justify-between items-center shrink-0 pt-[max(env(safe-area-inset-top),16px)] sm:pt-4 border-b border-zinc-100 shadow-sm z-10">
                     <div className="flex items-center gap-3 truncate">
                        <button onClick={() => { setActiveChannel(null); markRead(activeChannel.id); }} className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors"><ArrowLeft size={16}/></button>
                        <span className="font-bold tracking-tight text-zinc-900 truncate text-sm">{activeChannel.id === 'general' ? 'Team Chat' : activeChannel.participants.filter(p => p !== userRole.username).join(', ')}</span>
                     </div>
                     <div className="flex items-center gap-1 shrink-0 ml-2">
                        {activeChannel.id !== 'general' && userRole.role === 'manager' && (
                           <button onClick={deleteChannel} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Delete Chat"><Trash2 size={16}/></button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"><X size={18}/></button>
                     </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                     {messages.length === 0 && (
                        <div className="text-center text-zinc-400 text-sm mt-16 flex flex-col items-center gap-3">
                           <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center"><MessageSquare size={20} className="text-zinc-300"/></div>
                           <p className="font-semibold">Start the conversation!</p>
                        </div>
                     )}
                     {messages.map((m, idx) => {
                        const isMe = m.author === userRole.username;
                        const showAuthor = idx === 0 || messages[idx-1].author !== m.author;
                        return (
                           <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg relative mb-2`}>
                              {showAuthor && !isMe && <span className="text-[10px] font-bold text-zinc-400 mb-1 px-1 ml-1">{m.author}</span>}
                              {m.replyTo && (
                                <div className={`mb-1.5 max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                                  <div className="border-l-2 border-violet-300 bg-violet-50/60 rounded-r-xl px-3 py-2 text-[11px] text-zinc-500">
                                    <div className="font-bold text-violet-700 mb-0.5">Replying to {m.replyTo.author}</div>
                                    <div className="truncate">{m.replyTo.text}</div>
                                  </div>
                                </div>
                              )}

                              <div className="relative flex items-center gap-2">
                                 {!isMe && (
                                     <div className={`flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity ${reactionPickerId === m.id ? 'opacity-100' : ''}`}>
                                         <button onClick={() => setReplyingToMessageId(m.id)} className="p-1 text-zinc-400 hover:text-blue-600 transition-colors" title="Reply"><Reply size={14}/></button>
                                         <button onClick={() => setReactionPickerId(reactionPickerId === m.id ? null : m.id)} className="p-1 text-zinc-400 hover:text-amber-500 transition-colors" title="React"><Smile size={14}/></button>
                                     </div>
                                 )}

                                 <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm break-words shadow-sm font-medium ${isMe ? 'bg-zinc-900 text-white rounded-br-sm' : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-bl-sm'}`}>
                                    {renderFormattedText(m.text)}
                                 </div>

                                 {isMe && (
                                     <div className={`flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity ${reactionPickerId === m.id ? 'opacity-100' : ''}`}>
                                         <button onClick={() => setReplyingToMessageId(m.id)} className="p-1 text-zinc-400 hover:text-blue-600 transition-colors" title="Reply"><Reply size={14}/></button>
                                         <button onClick={() => setReactionPickerId(reactionPickerId === m.id ? null : m.id)} className="p-1 text-zinc-400 hover:text-amber-500 transition-colors" title="React"><Smile size={14}/></button>
                                     </div>
                                 )}

                                 {reactionPickerId === m.id && (
                                     <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white shadow-xl border border-zinc-200 rounded-full px-2 py-1 flex gap-1 z-50 animate-in zoom-in duration-200">
                                         {['👍', '❤️', '😂', '😲', '👎'].map(e => (
                                             <button key={e} onClick={() => { toggleChatReaction(m.id, e, m.reactions); setReactionPickerId(null); }} className="hover:scale-125 transition-transform text-base">{e}</button>
                                         ))}
                                     </div>
                                 )}
                              </div>

                              {renderReactions(m.reactions, (e) => toggleChatReaction(m.id, e, m.reactions), isMe)}

                              {replyingToMessageId === m.id && (
                                <div className={`w-full mt-2 ${isMe ? 'pr-8' : 'pl-8'}`}>
                                  <div className="border-l-2 border-violet-300 pl-3">
                                    <RichTextComposer
                                      placeholder={`Reply to ${m.author}...`}
                                      submitLabel="Reply"
                                      cancelLabel="Cancel"
                                      onCancel={() => setReplyingToMessageId(null)}
                                      accent="violet"
                                      compact
                                      autoFocus
                                      onSubmit={(text) => sendMessage(text)}
                                    />
                                  </div>
                                </div>
                              )}
                           </div>
                        )
                     })}
                     <div ref={messagesEndRef} className="h-2" />
                  </div>
                  
                  <div className="p-4 bg-white border-t border-zinc-100 shrink-0 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 rounded-b-[2rem]">
                    <RichTextComposer
                      placeholder="Type a message..."
                      submitLabel="Send"
                      onSubmit={sendMessage}
                    />
                  </div>
               </div>
            )}
          </div>
       )}

       <button onClick={handleToggleChat} className="w-16 h-16 bg-zinc-900 text-white rounded-3xl shadow-[0_10px_30px_rgb(0,0,0,0.25)] flex items-center justify-center hover:bg-zinc-800 hover:scale-105 transition-all duration-300 relative outline-none focus:ring-4 focus:ring-zinc-500/30">
          <MessageSquare size={26} />
          {totalUnread > 0 && !isOpen && (
             <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-in zoom-in">{totalUnread}</span>
          )}
       </button>
    </div>
  );
}

function Timeline({
  tasks,
  zoomLevel,
  onTaskClick,
  canEditTask,
  onTaskDateChange,
  onTaskCreate
}) {
  const [dragState, setDragState] = useState(null);
  const [draftDates, setDraftDates] = useState({});
  const [creationDrag, setCreationDrag] = useState(null);

  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const DAY_MS = 1000 * 60 * 60 * 24;

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const getTaskDates = (task) => draftDates[task.id] || {
    startDate: task.startDate,
    endDate: task.endDate
  };

  const beginInteraction = (e, task, mode) => {
    if (!canEditTask(task)) return;

    e.preventDefault();
    e.stopPropagation();

    const dates = getTaskDates(task);

    dragRef.current = {
      taskId: task.id,
      mode,
      startX: e.clientX,
      originalStart: dates.startDate,
      originalEnd: dates.endDate,
      currentStart: dates.startDate,
      currentEnd: dates.endDate,
      moved: false
    };

    setDragState({
      taskId: task.id,
      mode
    });

    suppressClickRef.current = false;
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      const interaction = dragRef.current;
      if (!interaction) return;

      const deltaPixels = e.clientX - interaction.startX;
      const deltaDays = Math.round(deltaPixels / (zoomLevel || 44));

      if (deltaDays === 0) return;

      interaction.moved = true;
      suppressClickRef.current = true;

      const originalStart = parseDate(interaction.originalStart);
      const originalEnd = parseDate(interaction.originalEnd);

      let newStart = originalStart;
      let newEnd = originalEnd;

      if (interaction.mode === 'move') {
        newStart = addDays(originalStart, deltaDays);
        newEnd = addDays(originalEnd, deltaDays);
      } else if (interaction.mode === 'resize-start') {
        newStart = addDays(originalStart, deltaDays);
        if (newStart > originalEnd) {
          newStart = originalEnd;
        }
      } else if (interaction.mode === 'resize-end') {
        newEnd = addDays(originalEnd, deltaDays);
        if (newEnd < originalStart) {
          newEnd = originalStart;
        }
      }

      const startDate = formatDateLocal(newStart);
      const endDate = formatDateLocal(newEnd);

      interaction.currentStart = startDate;
      interaction.currentEnd = endDate;

      setDraftDates(prev => ({
        ...prev,
        [interaction.taskId]: {
          startDate,
          endDate
        }
      }));
    };

    const handlePointerUp = async () => {
      const interaction = dragRef.current;
      if (!interaction) return;

      dragRef.current = null;
      setDragState(null);

      if (!interaction.moved) return;

      const {
        taskId,
        originalStart,
        originalEnd,
        currentStart,
        currentEnd
      } = interaction;

      if (originalStart === currentStart && originalEnd === currentEnd) {
        return;
      }

      const saved = await onTaskDateChange(
        taskId,
        currentStart,
        currentEnd
      );

      if (!saved) {
        setDraftDates(prev => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [zoomLevel, onTaskDateChange, canEditTask]);

  useEffect(() => {
    setDraftDates(prev => {
      let changed = false;
      const next = { ...prev };

      Object.keys(next).forEach(taskId => {
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
          delete next[taskId];
          changed = true;
          return;
        }

        if (
          task.startDate === next[taskId].startDate &&
          task.endDate === next[taskId].endDate
        ) {
          delete next[taskId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tasks]);

  if (!tasks.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
          <CalendarIcon size={20} className="text-zinc-300" />
        </div>
        <p className="font-semibold text-sm">No tasks to display</p>
      </div>
    );
  }

  const allDates = tasks.flatMap(t => [
    parseDate(t.startDate),
    parseDate(t.endDate)
  ]).filter(Boolean);

  const minDate = new Date(Math.min(...allDates));
  minDate.setDate(minDate.getDate() - 7);

  const maxDate = new Date(Math.max(...allDates));
  maxDate.setDate(maxDate.getDate() + 14);

  const totalDays = Math.ceil((maxDate - minDate) / DAY_MS);
  const dayWidth = zoomLevel || 44;

  const monthGroups = [];
  let currentMonthStr = "";
  let currentMonthDays = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    const mStr = d.toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });

    if (mStr !== currentMonthStr) {
      if (currentMonthStr !== "") {
        monthGroups.push({
          label: currentMonthStr,
          count: currentMonthDays
        });
      }

      currentMonthStr = mStr;
      currentMonthDays = 1;
    } else {
      currentMonthDays++;
    }
  }

  if (currentMonthStr !== "") {
    monthGroups.push({
      label: currentMonthStr,
      count: currentMonthDays
    });
  }

  const handleBgPointerDown = (e) => {
    if (!onTaskCreate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / dayWidth);
    setCreationDrag({ startIdx: dayIndex, currentIdx: dayIndex });

    const onPointerMove = (moveEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      const moveDayIndex = Math.floor(moveX / dayWidth);
      setCreationDrag(prev => prev ? { ...prev, currentIdx: moveDayIndex } : null);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      setCreationDrag(prev => {
        if (prev) {
          const start = Math.min(prev.startIdx, prev.currentIdx);
          const end = Math.max(prev.startIdx, prev.currentIdx);
          const startDate = addDays(minDate, start);
          const endDate = addDays(minDate, end);
          onTaskCreate({ startDate: formatDateLocal(startDate), endDate: formatDateLocal(endDate) });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="relative min-w-max min-h-full pb-8">
      <div className="flex flex-col sticky top-0 bg-white z-20 border-b border-zinc-200/60 shadow-sm">
        {/* Months Row */}
        <div className="flex border-b border-zinc-200/40 bg-zinc-50/50">
          {monthGroups.map((mg, idx) => (
            <div
              key={idx}
              style={{ width: mg.count * dayWidth }}
              className="flex-shrink-0 border-r border-zinc-200/40 relative"
            >
              <span className="sticky left-0 inline-block px-3 py-1.5 text-[10px] font-black text-violet-700 uppercase tracking-widest whitespace-nowrap z-30">
                {mg.label}
              </span>
            </div>
          ))}
        </div>

        {/* Days Row */}
        <div className="flex pb-1.5 pt-1.5">
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = addDays(minDate, i);
            const isToday = d.toDateString() === new Date().toDateString();
            const dayLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div
                key={i}
                className={`flex-shrink-0 border-r border-zinc-200/40 flex flex-col items-center justify-end pb-1.5 pt-1 ${
                  isToday
                    ? 'bg-violet-50/80 rounded-t-xl border-violet-200'
                    : isWeekend
                      ? 'bg-zinc-100'
                      : ''
                }`}
                style={{ width: dayWidth }}
              >
                <span
                  className={`text-[8px] font-black ${
                    isToday
                      ? 'text-violet-600'
                      : isWeekend
                        ? 'text-zinc-500'
                        : 'text-zinc-400'
                  }`}
                >
                  {dayLetter}
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isToday
                      ? 'text-violet-700'
                      : isWeekend
                        ? 'text-zinc-600'
                        : 'text-zinc-800'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-6 space-y-3.5 relative">
        {/* Background day columns */}
        <div 
          className="absolute inset-0 flex pt-6 z-0"
          onPointerDown={handleBgPointerDown}
          style={{ touchAction: 'none' }}
        >
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = addDays(minDate, i);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div
                key={`bg-${i}`}
                className={`flex-shrink-0 h-full border-r border-zinc-200/30 ${
                  isWeekend ? 'bg-zinc-100' : ''
                }`}
                style={{ width: dayWidth }}
              />
            );
          })}
        </div>

        {creationDrag && (
           <div 
             className="absolute top-6 bottom-0 bg-violet-500/20 border-2 border-violet-500 border-dashed rounded-lg z-0 pointer-events-none"
             style={{
               left: Math.min(creationDrag.startIdx, creationDrag.currentIdx) * dayWidth,
               width: (Math.abs(creationDrag.currentIdx - creationDrag.startIdx) + 1) * dayWidth
             }}
           />
        )}

        {tasks.map(task => {
          const dates = getTaskDates(task);
          const start = parseDate(dates.startDate);
          const end = parseDate(dates.endDate);

          const leftDays = Math.floor((start - minDate) / DAY_MS);
          const durationDays = Math.ceil((end - start) / DAY_MS) + 1;
          const editable = canEditTask(task);
          const isInteracting = dragState?.taskId === task.id;

          return (
            <div
              key={task.id}
              className="relative h-9 group"
              style={{ width: totalDays * dayWidth }}
            >
              <div
                onClick={(e) => {
                  if (suppressClickRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    suppressClickRef.current = false;
                    return;
                  }

                  onTaskClick(task);
                }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  beginInteraction(e, task, 'move');
                }}
                className={`absolute h-7 top-1 rounded-xl shadow-sm border border-black/5 overflow-hidden flex items-center z-10 ${
                  editable
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'
                } ${
                  isInteracting
                    ? 'ring-2 ring-violet-400 shadow-lg'
                    : 'transition-all hover:scale-[1.02] hover:shadow-md hover:ring-2 hover:ring-violet-400/50'
                }`}
                style={{
                  left: leftDays * dayWidth,
                  width: Math.max(durationDays * dayWidth, 12),
                  backgroundColor: `${task.color}15`,
                  borderLeft: `4px solid ${task.color}`,
                  touchAction: 'none',
                  userSelect: 'none'
                }}
                title={
                  editable
                    ? `${task.name} (${dates.startDate} - ${dates.endDate}) — Drag to move; drag either edge to resize`
                    : `${task.name} (${dates.startDate} - ${dates.endDate}) - Click to Edit`
                }
              >
                {/* Left resize handle */}
                {editable && (
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      beginInteraction(e, task, 'resize-start');
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 rounded-l-xl hover:bg-violet-500/30"
                    style={{ touchAction: 'none' }}
                    title="Drag to change start date"
                  />
                )}

                {/* Progress indicator */}
                <div
                  className="absolute bottom-0 left-0 h-1 opacity-50 transition-all duration-300 ease-out rounded-b-xl"
                  style={{
                    width: `${task.progress || 0}%`,
                    backgroundColor: task.color
                  }}
                />

                {/* Task name */}
                <span className="relative px-3 text-xs font-bold text-zinc-800 truncate z-10 pointer-events-none drop-shadow-sm">
                  {task.name}
                </span>

                {/* Right resize handle */}
                {editable && (
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      beginInteraction(e, task, 'resize-end');
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 rounded-r-xl hover:bg-violet-500/30"
                    style={{ touchAction: 'none' }}
                    title="Drag to change end date"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Today marker */}
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-violet-400 z-0 opacity-60 pointer-events-none"
          style={{
            left:
              Math.floor((new Date() - minDate) / DAY_MS) * dayWidth +
              dayWidth / 2
          }}
        />
      </div>
    </div>
  );
}

function Calendar({ tasks, onTaskClick, onTaskCreate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [creationDrag, setCreationDrag] = useState(null);
  
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const days = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const totalSlots = Math.ceil((days + firstDay) / 7) * 7;
  
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); };
  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); };

  const formatCalDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  const startDateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1 - firstDay);
  const weeks = [];
  let currentWeek = [];
  
  for (let i = 0; i < totalSlots; i++) {
     const dObj = new Date(startDateObj);
     dObj.setDate(startDateObj.getDate() + i);
     const dateStr = formatCalDate(dObj);
     const isCurrentMonth = dObj.getMonth() === currentMonth.getMonth();
     const dayNum = dObj.getDate();
     
     currentWeek.push({ dayNum, isCurrentMonth, dateStr, index: i % 7 });
     if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }

  useEffect(() => {
    const handleMouseUp = () => {
       if (creationDrag) setCreationDrag(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [creationDrag]);

  const handleDayMouseDown = (dateStr) => {
     if (!onTaskCreate) return;
     setCreationDrag({ start: dateStr, end: dateStr });
  };

  const handleDayMouseEnter = (dateStr) => {
     if (creationDrag) setCreationDrag(prev => ({ ...prev, end: dateStr }));
  };

  const handleDayMouseUp = (dateStr) => {
     if (creationDrag && onTaskCreate) {
        const start = creationDrag.start;
        const end = dateStr;
        const finalStart = start < end ? start : end;
        const finalEnd = start > end ? start : end;
        onTaskCreate({ startDate: finalStart, endDate: finalEnd });
        setCreationDrag(null);
     }
  };

  return (
    <div className="flex flex-col min-h-full pb-8">
      <div className="flex justify-between items-center mb-6 flex-shrink-0 sticky top-0 bg-white z-20 py-2">
        <button onClick={prevMonth} className="p-2.5 hover:bg-zinc-50 rounded-2xl shadow-sm border border-zinc-200/80 transition-all text-zinc-700 font-bold">&lt;</button>
        <h3 className="font-extrabold tracking-tight text-xl text-zinc-900">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={nextMonth} className="p-2.5 hover:bg-zinc-50 rounded-2xl shadow-sm border border-zinc-200/80 transition-all text-zinc-700 font-bold">&gt;</button>
      </div>
      
      <div className="bg-zinc-200/60 border border-zinc-200/80 rounded-[1.5rem] overflow-hidden flex flex-col flex-1 shadow-sm">
        <div className="grid grid-cols-7 gap-px bg-zinc-200/60 shrink-0">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="bg-zinc-50 p-3 text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">{d}</div>)}
        </div>
        
        {weeks.map((week, wIdx) => {
           const weekStartStr = week[0].dateStr;
           const weekEndStr = week[6].dateStr;
           const activeTasks = [];

           tasks.forEach(t => {
              if (!t.startDate || !t.endDate) return;
              if (t.endDate < weekStartStr || t.startDate > weekEndStr) return;

              let startIdx = week.findIndex(d => d.dateStr >= t.startDate);
              let endIdx = week.findLastIndex(d => d.dateStr <= t.endDate);

              if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
                 activeTasks.push({ ...t, startIdx, endIdx });
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
              <div key={wIdx} className="grid grid-cols-7 gap-px bg-zinc-200/60 flex-1 min-h-[120px] relative">
                 {week.map((day, dIdx) => {
                    const isDraggingThisDay = creationDrag && (
                       (day.dateStr >= creationDrag.start && day.dateStr <= creationDrag.end) ||
                       (day.dateStr <= creationDrag.start && day.dateStr >= creationDrag.end)
                    );

                    return (
                       <div 
                         key={dIdx} 
                         className={`p-2 select-none ${day.isCurrentMonth ? 'bg-white' : 'bg-zinc-50'} ${isDraggingThisDay ? 'ring-2 ring-inset ring-violet-500 bg-violet-50' : ''}`}
                         onMouseDown={() => handleDayMouseDown(day.dateStr)}
                         onMouseEnter={() => handleDayMouseEnter(day.dateStr)}
                         onMouseUp={() => handleDayMouseUp(day.dateStr)}
                       >
                          <span className={`text-xs font-bold ${day.isCurrentMonth ? 'text-zinc-700' : 'text-zinc-300'}`}>{day.dayNum}</span>
                       </div>
                    );
                 })}
                 
                 <div className="absolute inset-0 pt-8 pointer-events-none">
                    {rowSlots.map((row, rIdx) => (
                       <div key={rIdx} className="relative h-6 mb-1">
                          {row.map(task => {
                             const leftPct = (task.startIdx / 7) * 100;
                             const widthPct = ((task.endIdx - task.startIdx + 1) / 7) * 100;
                             return (
                                <div 
                                  key={task.id} onClick={() => onTaskClick(task)}
                                  className="absolute h-5 rounded-md text-[10px] font-medium text-white px-2 truncate cursor-pointer shadow-sm pointer-events-auto flex items-center hover:ring-2 hover:ring-zinc-900/20 transition-all hover:scale-[1.01] hover:z-10"
                                  style={{ left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)`, backgroundColor: task.color }}
                                  title={`${task.name} (${formatDate(task.startDate)} - ${formatDate(task.endDate)}) - Click to Edit`}
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
