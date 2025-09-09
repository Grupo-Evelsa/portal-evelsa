// Aquí importo todo lo que necesito de React y Firebase para que la app funcione.
// También configuro la conexión a mi proyecto de Firebase con mis credenciales.

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc,
    updateDoc,
    onSnapshot,
    setDoc,
    Timestamp,
    runTransaction,
    orderBy,
    deleteDoc,
    deleteField,
    arrayUnion
} from 'firebase/firestore';
import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from 'firebase/storage';

import { Bar } from 'react-chartjs-2';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, LineController, Title, Tooltip, Legend, ArcElement } from 'chart.js';


// Registro los componentes de Chart.js para poder usar las gráficas.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController, 
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Mis credenciales de Firebase para conectar el frontend con el backend.
const firebaseConfig = {
  apiKey: "AIzaSyA7H6G0mXCy9DmoLg3fSW3TrxIRcEzz9jg",
  authDomain: "portal-evelsa.firebaseapp.com",
  projectId: "portal-evelsa",
  storageBucket: "portal-evelsa.firebasestorage.app",
  messagingSenderId: "847174487471",
  appId: "1:847174487471:web:c3a57fd8315ce619a2335a"
};

// Inicializo Firebase para poder usar la base de datos, autenticación, etc.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Mi componente de Alerta para mostrar mensajes de éxito o error.
const Alert = ({ message, type, onClose }) => {
    if (!message) return null;
    const baseClasses = "p-4 mb-4 text-sm rounded-lg relative";
    const typeClasses = { error: "bg-red-100 text-red-800", success: "bg-green-100 text-green-800" };
    return (
        <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="absolute top-0 right-0 mt-2 mr-3 text-2xl font-semibold leading-none">&times;</button>
        </div>
    );
};


/**
 * Calcula una fecha futura añadiendo días hábiles (lunes a viernes).
 * @param {Date} startDate La fecha de inicio.
 * @param {number} days El número de días hábiles a añadir.
 * @return {Date} La fecha futura.
 */
const addBusinessDays = (startDate, days) => {
    if (!startDate) return null;
    let currentDate = new Date(startDate);
    let addedDays = 0;
    while (addedDays < days) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Domingo, 6 = Sábado
            addedDays++;
        }
    }
    return currentDate;
};

// Mi modal de confirmación genérico para acciones simples (ej. "¿Estás seguro?").
const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", confirmColor = "bg-green-600" }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">{cancelText}</button>
                    <button onClick={onConfirm} className={`${confirmColor} hover:opacity-90 text-white font-bold py-2 px-4 rounded`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

// Mi modal para acciones que necesitan una razón por escrito (ej. rechazar un proyecto).
const ActionWithReasonModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", confirmColor = "bg-orange-600" }) => {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{title}</h3>
                <p className="text-sm text-gray-600 mb-4">{message}</p>
                <textarea 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    placeholder="Escribe el motivo aquí..." 
                    rows="3"
                    className="w-full p-2 border rounded-md"
                ></textarea>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onCancel} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">{cancelText}</button>
                    <button onClick={() => onConfirm(reason)} className={`${confirmColor} hover:opacity-90 text-white font-bold py-2 px-4 rounded`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const SupervisorNoteModal = ({ project, onClose, onUpdate }) => {
    const [note, setNote] = useState(project.notasSupervisor || '');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        const projectRef = doc(db, "proyectos", project.id);
        try {
            await updateDoc(projectRef, {
                notasSupervisor: note,
            });
            onUpdate();
            onClose();
        } catch (err) {
            console.error("Error al guardar la nota:", err);
            alert("No se pudo guardar la nota.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-bold mb-4">Notas del Supervisor: {project.npu}</h3>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Escribe tus notas personales aquí..."
                    rows="5"
                    className="w-full p-2 border rounded-md"
                ></textarea>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        {loading ? 'Guardando...' : 'Guardar Nota'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// El Header o cabecera de la página. Muestra el logo y el botón de salir.
// También contiene el nuevo selector de roles para usuarios con más de uno.
const Header = ({ user, userData, selectedRole, setSelectedRole }) => {
    const logoGrupoEvelsa = "https://www.grupoevelsa.com/assets/images/Logo Evelsa 2.png";
    const hasMultipleRoles = userData?.roles && userData.roles.length > 1;

    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                <div className="flex items-center">
                    {userData && userData.rol === 'cliente' && userData.logoUrl ? (
                        <img src={userData.logoUrl} onError={(e)=>{e.target.onerror = null; e.target.src="https://placehold.co/150x50/FFFFFF/000000?text=Logo+Cliente"}} alt="Logo Cliente" className="h-12 w-auto mr-4 object-contain"/>
                    ) : (
                        <img src={logoGrupoEvelsa} alt="Logo Grupo Evelsa" className="h-12 w-auto mr-4"/>
                    )}
                </div>
                {user && (
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-600 hidden sm:block">
                            Hola, {userData ? userData.nombreCompleto.split(' ')[0] : user.email}
                        </span>

                        {hasMultipleRoles && (
                            <div className="relative">
                                <select 
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="appearance-none bg-gray-100 border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {userData.roles.map(role => (
                                        <option key={role} value={role} className="capitalize">{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <button onClick={() => signOut(auth)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                            Salir
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

const ProjectLogModal = ({ project, user, userData, onClose, selectedRole }) => {
    const [logEntries, setLogEntries] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [newFile, setNewFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const canWrite = selectedRole !== "supervisor";

    useEffect(() => {
        const q = query(collection(db, "bitacoras_proyectos"), where("projectId", "==", project.id), orderBy("fecha", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setLogEntries(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => {
            console.error(`Error fetching log entries:`, err);
            setError(`No se pudo cargar la bitácora.`);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [project.id]);

    const handleFileChange = (e) => {
        if (e.target.files[0]) setNewFile(e.target.files[0]);
    };

    const handleSubmitNote = async () => {
        if (!newNote && !newFile) return;
        setSubmitting(true);
        setError('');

        try {
            let fileUrl = '';
            if (newFile) {
                const storageRef = ref(storage, `bitacoras/${project.id}/${Date.now()}_${newFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, newFile);
                fileUrl = await getDownloadURL((await uploadTask).ref);
            }

            await addDoc(collection(db, "bitacoras_proyectos"), {
                projectId: project.id,
                autorId: user.uid,
                autorNombre: userData.nombreCompleto,
                mensaje: newNote,
                adjuntoUrl: fileUrl,
                fecha: Timestamp.now()
            });

            setNewNote('');
            setNewFile(null);
            const fileInput = document.getElementById(`file-input-${project.id}`);
            if(fileInput) fileInput.value = "";

        } catch (err) {
            console.error("Error al guardar en bitácora:", err);
            setError("No se pudo guardar la nota. Por favor, intente de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp) => !timestamp ? '---' : new Date(timestamp.seconds * 1000).toLocaleString('es-MX');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Bitácora del Proyecto: {project.npu}</h3>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-2xl font-bold">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto border rounded-md p-4 space-y-4 mb-4 bg-gray-50">
                    {loading ? <p>Cargando bitácora...</p> : logEntries.length === 0 ? <p>No hay entradas en la bitácora.</p> :
                        logEntries.map(entry => (
                            <div key={entry.id} className="p-3 bg-white rounded-lg shadow-sm">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.mensaje}</p>
                                {entry.adjuntoUrl && <a href={entry.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Ver adjunto</a>}
                                <p className="text-xs text-gray-500 mt-2 text-right">{entry.autorNombre} - {formatDate(entry.fecha)}</p>
                            </div>
                        ))
                    }
                </div>

                {canWrite && (
                    <div className="border-t pt-4">
                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Añadir nueva nota..." rows="3" className="w-full p-2 border rounded-md"></textarea>
                        <input type="file" id={`file-input-${project.id}`} onChange={handleFileChange} className="w-full text-sm mt-2"/>
                        <Alert message={error} type="error" onClose={() => setError('')} />
                        <button onClick={handleSubmitNote} disabled={submitting} className="w-full mt-2 bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded-lg disabled:bg-gray-300">
                            {submitting ? 'Guardando...' : 'Añadir a la Bitácora'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Componentes de Gestión (Para Administradores) ---
const UserManagement = ({ onUserAdded }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombreCompleto, setNombreCompleto] = useState('');
    const [rol, setRol] = useState('cliente');
    const [clienteIdNumerico, setClienteIdNumerico] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const resetForm = () => {
        setEmail(''); setPassword(''); setNombreCompleto(''); setRol('cliente');
        setClienteIdNumerico(''); setLogoUrl('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (!nombreCompleto || !email || !password) {
            setError('Nombre, email y contraseña son obligatorios.');
            return;
        }
        if (rol === 'cliente' && !clienteIdNumerico) {
             setError('Para clientes, el ID Numérico es obligatorio.');
            return;
        }

        try {
            const tempApp = initializeApp(firebaseConfig, `Secondary-${new Date().getTime()}`);
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            
            await setDoc(doc(db, "usuarios", userCredential.user.uid), {
                email, rol, nombreCompleto,
                clienteIdNumerico: rol === 'cliente' ? clienteIdNumerico.padStart(3, '0') : '',
                logoUrl: rol === 'cliente' ? logoUrl : '',
            });

            setSuccess(`¡Usuario ${email} con rol '${rol}' creado con éxito!`);
            resetForm();
            if (onUserAdded) onUserAdded();
        } catch (err) {
            setError(`Error al crear usuario: ${err.message}`);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Crear Nuevo Usuario</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <input type="text" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} placeholder="Nombre Completo" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                 <select value={rol} onChange={e => setRol(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
                    <option value="cliente">Cliente</option>
                    <option value="administrador">Administrador</option>
                    <option value="directivo">Directivo</option>
                    <option value="ecotech">Encargada Ecotech</option>
                    <option value="supervisor">Supervisor de Proyectos</option>
                    <option value="tecnico">Técnico</option>
                    <option value="finanzas">Finanzas</option>
                    <option value="practicante">Practicante</option>
                 </select>
                 <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email de Acceso" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                 <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 6 caracteres)" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                 {rol === 'cliente' && (
                     <>
                        <input type="text" value={clienteIdNumerico} onChange={e => setClienteIdNumerico(e.target.value)} placeholder="ID Numérico Cliente (ej: 001)" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                        <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="URL del Logo (Opcional)" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                     </>
                 )}
                 <Alert message={error} type="error" onClose={() => setError('')} />
                 <Alert message={success} type="success" onClose={() => setSuccess('')} />
                 <button type="submit" className="w-full bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded-lg">Crear Usuario</button>
            </form>
        </div>
    );
};

const DataManagement = ({ collectionName, title, fields, placeholderTexts }) => {
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const q = query(collection(db, collectionName));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const itemsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(itemsData);
            setLoading(false);
        }, (err) => {
            console.error(`Error fetching ${collectionName}:`, err);
            setError(`No se pudieron cargar los datos de ${title}.`);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [collectionName, title]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (fields.some(field => !newItem[field])) {
            setError('Todos los campos son obligatorios.');
            return;
        }
        setError('');
        setSuccess('');

        try {
            await addDoc(collection(db, collectionName), newItem);
            setSuccess(`¡${title.slice(0, -1)} añadido con éxito!`);
            setNewItem({});
        } catch (err) {
            setError(`Error al añadir el nuevo ítem: ${err.message}`);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Añadir Nuevo {title.slice(0, -1)}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field}>
                            <label className="block text-sm font-medium text-gray-700 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                            <input 
                                type="text" 
                                name={field} 
                                value={newItem[field] || ''} 
                                onChange={handleChange}
                                placeholder={placeholderTexts[index]}
                                className="mt-1 block w-full px-3 py-2 border rounded-md"
                            />
                        </div>
                    ))}
                    <Alert message={error} type="error" onClose={() => setError('')} />
                    <Alert message={success} type="success" onClose={() => setSuccess('')} />
                    <button type="submit" className="w-full bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded-lg">Añadir</button>
                </form>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                 <h3 className="text-xl font-bold text-gray-800 mb-4">{title} Existentes</h3>
                 <div className="overflow-y-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {fields.map(field => <th key={field} className="px-4 py-2 text-left text-xs font-medium uppercase">{field.replace(/([A-Z])/g, ' $1')}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? <tr><td colSpan={fields.length}>Cargando...</td></tr> : items.map(item => (
                                <tr key={item.id}>
                                    {fields.map(field => <td key={`${item.id}-${field}`} className="px-4 py-2 whitespace-nowrap text-sm">{item[field]}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

// -- DASHBOARDS POR ROL --

// El dashboard del Administrador. Contiene las pestañas para gestionar
// proyectos, usuarios, servicios, proveedores y la revisión final.
const AdminDashboard = () => {
    const [view, setView] = useState('projects');
    const [projects, setProjects] = useState([]);
    const [reviewProjects, setReviewProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const refreshData = () => {
        setLoading(true);
        const qProjects = query(collection(db, "proyectos"), orderBy("fechaApertura", "desc"));
        const unsubscribeProjects = onSnapshot(qProjects, (querySnapshot) => {
            setProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false); 
        });
        
        const qReview = query(collection(db, "proyectos"), where("estado", "==", "En Revisión Final"));
        const unsubscribeReview = onSnapshot(qReview, (querySnapshot) => {
            setReviewProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    
        return () => {
            unsubscribeProjects();
            unsubscribeReview();
        };
    };

    useEffect(() => {
        const unsubscribe = refreshData();
        return () => unsubscribe();
    }, []);

    return (
        <div>
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setView('projects')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'projects' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Proyectos</button>
                    <button onClick={() => setView('review')} className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'review' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Revisión Final
                        {reviewProjects.length > 0 && <span className="absolute top-2 -right-4 ml-2 px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{reviewProjects.length}</span>}
                    </button>
                    <button onClick={() => setView('users')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'users' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Usuarios</button>
                    <button onClick={() => setView('services')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'services' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Servicios</button>
                    <button onClick={() => setView('providers')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'providers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Proveedores</button>
                </nav>
            </div>
            
            {view === 'users' && <UserManagement onUserAdded={() => {}} />}
            
            {view === 'projects' && (
                <>
                    <NewProjectForm onProjectAdded={refreshData} />
                    <h2 className="text-2xl font-bold text-gray-800 my-6">Todos los Proyectos</h2>
                    {loading ? <p>Cargando tabla...</p> : <ProjectsTable projects={projects} onUpdateProject={refreshData} userRole="administrador" />}
                </>
            )}

            {view === 'review' && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 my-6">Proyectos Pendientes de Aprobación Final</h2>
                    {loading ? <p>Cargando...</p> : reviewProjects.length === 0 ? <p>No hay proyectos en revisión.</p> : <ReviewProjectsTable projects={reviewProjects} onUpdateProject={refreshData} />}
                </div>
            )}

            {view === 'services' && <DataManagement collectionName="servicios" title="Servicios" fields={['nombre', 'servicioIdNumerico', 'dependencia']} placeholderTexts={['Nombre del Servicio', 'ID Numérico (ej: 0001)', 'Dependencia']} />}
            {view === 'providers' && <DataManagement collectionName="proveedores" title="Proveedores" fields={['nombre', 'proveedorIdNumerico']} placeholderTexts={['Nombre del Proveedor', 'ID Numérico (ej: 01)']} />}
        </div>
    );
};

// El visor de documentos de Heyzine que uso en el dashboard del cliente.
const HeyzineViewerModal = ({ url, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold">Visor de Documentos</h3>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-2xl font-bold">&times;</button>
                </div>
                <div className="flex-grow">
                    <iframe src={url} title="Visor de Heyzine" className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                </div>
            </div>
        </div>
    );
};

const ProjectsShelf = ({ projects, onOpenModal }) => {
    const finishedProjects = projects.filter(p => p.estadoCliente === 'Terminado' && p.urlHeyzine);
    const coverTemplateUrl = "https://firebasestorage.googleapis.com/v0/b/portal-evelsa.firebasestorage.app/o/portada%20Carpetas.jpeg?alt=media&token=417eb65c-1694-4efc-9e2a-55528d43a8d6";

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {finishedProjects.map(project => (
                <button key={project.id} className="group text-left focus:outline-none" onClick={() => onOpenModal(project.urlHeyzine)}>
                    <div className="relative pt-[141%] bg-gray-200 rounded-lg shadow-lg group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 overflow-hidden">
                        <img src={coverTemplateUrl} alt="Portada de proyecto" className="absolute inset-0 w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                        <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-white text-center">
                            <h4 className="font-bold text-lg leading-tight">{project.clienteNombre}</h4>
                            <hr className="w-1/4 my-2 border-gray-400"/>
                            <p className="text-sm">{project.servicioNombre}</p>
                        </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mt-3 truncate group-hover:text-blue-600">{project.servicioNombre}</p>
                </button>
            ))}
        </div>
    );
};

const NewProjectForm = ({ onProjectAdded }) => {
    const [formData, setFormData] = useState({ 
        clienteId: '', 
        servicioId: '', 
        proveedorId: '', 
        comentariosApertura: '',
        fechaApertura: new Date().toISOString().split('T')[0],
        precioCotizacionCliente: '',
        costoProveedor: ''
    });
    const [files, setFiles] = useState({
        cotizacionClienteFile: null,
        poClienteFile: null,
        cotizacionProveedorFile: null,
        poProveedorFile: null
    });
    const formRef = React.useRef(null);

    const [collections, setCollections] = useState({ clientes: [], servicios: [], proveedores: [] });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isInternalProvider = collections.proveedores.find(p => p.id === formData.proveedorId)?.nombre.toLowerCase().trim() === "ecologia y asesoria ambiental";

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [clientesSnap, serviciosSnap, proveedoresSnap] = await Promise.all([
                    getDocs(query(collection(db, "usuarios"), where("rol", "==", "cliente"))),
                    getDocs(collection(db, "servicios")),
                    getDocs(collection(db, "proveedores"))
                ]);
                const sortByName = (a, b) => (a.nombreCompleto || a.nombre).localeCompare(b.nombreCompleto || b.nombre);
                setCollections({
                    clientes: clientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort(sortByName),
                    servicios: serviciosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort(sortByName),
                    proveedores: proveedoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort(sortByName)
                });
            } catch (e) {
                setError("Error al cargar datos maestros.");
            }
        };
        fetchData();
    }, []);
    
    useEffect(() => {
        if (isInternalProvider) {
            setFormData(prev => ({ ...prev, costoProveedor: '0' }));
        }
    }, [formData.proveedorId, isInternalProvider]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleFileChange = (e) => {
        const { name, files: inputFiles } = e.target;
        if (inputFiles[0]) {
            setFiles(prev => ({ ...prev, [name]: inputFiles[0] }));
        }
    };

    const uploadFile = async (file, path) => {
        if (!file) return null;
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);
        await uploadTask;
        return await getDownloadURL(uploadTask.snapshot.ref);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.clienteId || !formData.servicioId || !formData.proveedorId) {
            setError('Cliente, Servicio y Proveedor son obligatorios.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const urlCotizacionCliente = await uploadFile(files.cotizacionClienteFile, `cotizaciones_clientes/${Date.now()}_${files.cotizacionClienteFile?.name}`);
            const urlPOCliente = await uploadFile(files.poClienteFile, `po_clientes/${Date.now()}_${files.poClienteFile?.name}`);
            const urlCotizacionProveedor = await uploadFile(files.cotizacionProveedorFile, `cotizaciones_proveedores/${Date.now()}_${files.cotizacionProveedorFile?.name}`);
            const urlPOProveedor = await uploadFile(files.poProveedorFile, `po_proveedores/${Date.now()}_${files.poProveedorFile?.name}`);

            const anioActual = new Date(formData.fechaApertura).getFullYear();
            const contadorRef = doc(db, "contadores", `proyectos_${anioActual}`);
            const nuevoConsecutivo = await runTransaction(db, async (transaction) => {
                const contadorDoc = await transaction.get(contadorRef);
                const nuevoValor = (contadorDoc.exists() ? contadorDoc.data().consecutivo : 0) + 1;
                transaction.set(contadorRef, { consecutivo: nuevoValor }, { merge: true });
                return nuevoValor;
            });
            
            const ultimosDosDigitosAnio = anioActual.toString().slice(-2);
            const consecutivoFormateado = nuevoConsecutivo.toString().padStart(3, '0');
            
            const cliente = collections.clientes.find(c => c.id === formData.clienteId);
            const servicio = collections.servicios.find(s => s.id === formData.servicioId);
            const proveedor = collections.proveedores.find(p => p.id === formData.proveedorId);

            const npu = `${cliente.clienteIdNumerico}-${servicio.servicioIdNumerico}-${proveedor.proveedorIdNumerico}-${consecutivoFormateado}${ultimosDosDigitosAnio}`;
            const poProveedorAuto = isInternalProvider ? "N/A" : npu.slice(-8);
            const estadoInicial = urlPOCliente ? 'Activo' : 'Cotización';

            await addDoc(collection(db, "proyectos"), {
                fechaApertura: Timestamp.fromDate(new Date(formData.fechaApertura)),
                npu,
                clienteId: formData.clienteId,
                clienteNombre: cliente.nombreCompleto,
                servicioId: formData.servicioId,
                servicioNombre: servicio.nombre,
                proveedorId: formData.proveedorId,
                proveedorNombre: proveedor.nombre,
                comentariosApertura: formData.comentariosApertura,
                estado: estadoInicial,
                estadoCliente: estadoInicial,
                dependencia: servicio.dependencia || 'Sin Dependencia',
                asignadoTecnicosIds: [],
                tecnicosStatus: {},
                precioCotizacionCliente: Number(formData.precioCotizacionCliente) || 0,
                urlCotizacionCliente: urlCotizacionCliente || '',
                urlPOCliente: urlPOCliente || '',
                costoProveedor: Number(formData.costoProveedor) || 0,
                poProveedor: poProveedorAuto,
                urlCotizacionProveedor: urlCotizacionProveedor || '',
                urlPOProveedor: urlPOProveedor || '',
            });
            
            setFormData({ clienteId: '', servicioId: '', proveedorId: '', comentariosApertura: '', fechaApertura: new Date().toISOString().split('T')[0], precioCotizacionCliente: '', costoProveedor: '' });
            formRef.current.reset();
            if (onProjectAdded) onProjectAdded();

        } catch (err) {
            console.error("Error al crear proyecto:", err);
            setError(`Ocurrió un error: ${err.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Crear Nuevo Proyecto</h3>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha de Apertura</label>
                        <input type="date" name="fechaApertura" value={formData.fechaApertura} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                     <select name="clienteId" value={formData.clienteId} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
                        <option value="">Seleccione un Cliente</option>
                        {collections.clientes.map(c => <option key={c.id} value={c.id}>{c.nombreCompleto}</option>)}
                     </select>
                     <select name="servicioId" value={formData.servicioId} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
                        <option value="">Seleccione un Proyecto/Servicio</option>
                        {collections.servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                     </select>
                     <select name="proveedorId" value={formData.proveedorId} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
                        <option value="">Seleccione un Proveedor</option>
                        {collections.proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                     </select>
                    <textarea name="comentariosApertura" value={formData.comentariosApertura} onChange={handleChange} placeholder="Comentarios de apertura" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700">Información del Cliente</h4>
                        <div>
                            <label className="block text-sm font-medium">Precio Cotización (sin IVA)</label>
                            <input type="number" name="precioCotizacionCliente" value={formData.precioCotizacionCliente} onChange={handleChange} placeholder="0.00" className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">PDF Cotización</label>
                            <input type="file" name="cotizacionClienteFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">PDF Orden de Compra (PO)</label>
                            <input type="file" name="poClienteFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700">Información del Proveedor</h4>
                        <div>
                            <label className="block text-sm font-medium">Costo (sin IVA)</label>
                            <input type="number" name="costoProveedor" value={formData.costoProveedor} onChange={handleChange} placeholder="0.00" disabled={isInternalProvider} className="mt-1 block w-full px-3 py-2 border rounded-md disabled:bg-gray-100"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">{isInternalProvider ? 'Número de Proyecto' : 'PDF Cotización Proveedor'}</label>
                            <input type="file" name="cotizacionProveedorFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">PDF Orden de Compra (PO) Proveedor</label>
                            <input type="file" name="poProveedorFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>
                        </div>
                    </div>
                </div>

                <Alert message={error} type="error" onClose={() => setError('')} />
                <button type="submit" disabled={loading} className="w-full bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                    {loading ? 'Creando...' : 'Crear Proyecto y Generar NPU'}
                </button>
            </form>
        </div>
    );
};

const ProjectsTable = ({ projects, onUpdateProject, userRole, supervisorView, user, userData }) => {
    const [modalProject, setModalProject] = useState(null);
    const [modalType, setModalType] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [techniciansMap, setTechniciansMap] = useState({});
    const [invoicesMap, setInvoicesMap] = useState({});
    const [confirmingAction, setConfirmingAction] = useState(null);
    const [noteModalProject, setNoteModalProject] = useState(null);

    useEffect(() => {
        const fetchExtraData = () => {
            const qTechsOld = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
            const qTechsNew = query(collection(db, "usuarios"), where("roles", "array-contains", "tecnico"));

            const unsubTechs = onSnapshot(qTechsNew, (snapshotNew) => {
                const techMap = {};
                snapshotNew.forEach(doc => { techMap[doc.id] = doc.data().nombreCompleto; })
                getDocs(qTechsOld).then(snapshotOld => {
                    snapshotOld.forEach(doc => {
                        if (!techMap[doc.id]) {
                            techMap[doc.id] = doc.data().nombreCompleto;
                        }
                    });
                    setTechniciansMap(techMap);
                });
            });

            const qInvoices = query(collection(db, "facturas"));
            const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
                const invMap = {};
                snapshot.forEach(doc => { invMap[doc.id] = doc.data().folio; });
                setInvoicesMap(invMap);
            });

            return () => {
                unsubTechs();
                unsubInvoices();
            };
        };
        const unsubscribe = fetchExtraData();
        return () => unsubscribe();
    }, []);

    const ManageProjectModal = ({ project, onClose, onFinalized }) => {
        const [files, setFiles] = useState({ cotizacionClienteFile: null, poClienteFile: null, cotizacionProveedorFile: null, poProveedorFile: null });
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [precio, setPrecio] = useState(project.precioCotizacionCliente || '');
        const [costo, setCosto] = useState(project.costoProveedor || '');

        const handleFileChange = (e) => {
            const { name, files: inputFiles } = e.target;
            if (inputFiles[0]) setFiles(prev => ({ ...prev, [name]: inputFiles[0] }));
        };

        const uploadFile = async (file, path) => {
            if (!file) return null;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            await uploadTask;
            return await getDownloadURL(uploadTask.snapshot.ref);
        };

        const handleSave = async () => {
            setLoading(true);
            setError('');
            try {
                const updatePayload = {
                    precioCotizacionCliente: Number(precio) || 0,
                    costoProveedor: Number(costo) || 0,
                };

                const urlCotizacionCliente = await uploadFile(files.cotizacionClienteFile, `cotizaciones_clientes/${Date.now()}_${files.cotizacionClienteFile?.name}`);
                const urlPOCliente = await uploadFile(files.poClienteFile, `po_clientes/${Date.now()}_${files.poClienteFile?.name}`);
                const urlCotizacionProveedor = await uploadFile(files.cotizacionProveedorFile, `cotizaciones_proveedores/${Date.now()}_${files.cotizacionProveedorFile?.name}`);
                const urlPOProveedor = await uploadFile(files.poProveedorFile, `po_proveedores/${Date.now()}_${files.poProveedorFile?.name}`);

                if(urlCotizacionCliente) updatePayload.urlCotizacionCliente = urlCotizacionCliente;
                if(urlPOCliente) updatePayload.urlPOCliente = urlPOCliente;
                if(urlCotizacionProveedor) updatePayload.urlCotizacionProveedor = urlCotizacionProveedor;
                if(urlPOProveedor) updatePayload.urlPOProveedor = urlPOProveedor;

                if (urlPOCliente) {
                    updatePayload.estado = 'Activo';
                    updatePayload.estadoCliente = 'Activo';
                }

                await updateDoc(doc(db, "proyectos", project.id), updatePayload);
                
                onFinalized();
                onClose();
            } catch (err) {
                setError("Error al subir documentos o guardar cambios.");
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Gestionar Proyecto: {project.npu}</h3>

                    <div className="grid grid-cols-2 gap-4 mb-6 border-b pb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Precio Cliente (sin IVA)</label>
                            <input
                                type="number"
                                value={precio}
                                onChange={(e) => setPrecio(e.target.value)}
                                placeholder="0.00"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Costo Proveedor (sin IVA)</label>
                            <input
                                type="number"
                                value={costo}
                                onChange={(e) => setCosto(e.target.value)}
                                placeholder="0.00"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>
                    
                    <h4 className="text-md font-semibold mb-4 text-gray-800">Gestionar Documentos</h4>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium">PDF Cotización Cliente</label>{project.urlCotizacionCliente ? <a href={project.urlCotizacionCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm">Ver actual</a> : <input type="file" name="cotizacionClienteFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>}</div>
                        <div><label className="block text-sm font-medium">PDF Orden de Compra (PO) Cliente</label>{project.urlPOCliente ? <a href={project.urlPOCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm">Ver actual</a> : <input type="file" name="poClienteFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>}</div>
                        <div><label className="block text-sm font-medium">PDF Cotización Proveedor</label>{project.urlCotizacionProveedor ? <a href={project.urlCotizacionProveedor} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm">Ver actual</a> : <input type="file" name="cotizacionProveedorFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>}</div>
                        <div><label className="block text-sm font-medium">PDF Orden de Compra (PO) Proveedor</label>{project.urlPOProveedor ? <a href={project.urlPOProveedor} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm">Ver actual</a> : <input type="file" name="poProveedorFile" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>}</div>
                    </div>
                    
                    <Alert message={error} type="error" onClose={() => setError('')} />
                    <div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} disabled={loading} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button><button onClick={handleSave} disabled={loading} className="bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Cambios'}</button></div>
                </div>
            </div>
        );
    };
    
    const AssignProjectModal = ({ project, onClose, onFinalized }) => {
        const [technicians, setTechnicians] = useState([]);
        const [selectedTechnicianId, setSelectedTechnicianId] = useState(
            (project.asignadoTecnicosIds && project.asignadoTecnicosIds[0]) || ''
        );
        const [deliveryDate, setDeliveryDate] = useState(project.fechaEntregaInterna ? project.fechaEntregaInterna.toDate().toISOString().split('T')[0] : '');
        const [loading, setLoading] = useState(false);

        useEffect(() => {
            const fetchTechnicians = async () => {
                const q1 = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
                const q2 = query(collection(db, "usuarios"), where("roles", "array-contains", "tecnico"));

                const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                const techMap = new Map();
                snapshot1.forEach((doc) => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
                snapshot2.forEach((doc) => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
                
                setTechnicians(Array.from(techMap.values()));
            };
            fetchTechnicians();
        }, []);

        const handleSave = async () => {
            if (!selectedTechnicianId) {
                alert("Debes seleccionar un técnico.");
                return;
            }
            setLoading(true);
            const projectRef = doc(db, "proyectos", project.id);
            
            const tecnicosStatus = {};
            tecnicosStatus[selectedTechnicianId] = project.tecnicosStatus?.[selectedTechnicianId] || "No Visto";

            await updateDoc(projectRef, {
                asignadoTecnicosIds: [selectedTechnicianId],
                tecnicosStatus: tecnicosStatus,
                fechaAsignacionTecnico: Timestamp.now(),
                fechaEntregaInterna: deliveryDate ? Timestamp.fromDate(new Date(deliveryDate)) : null
            });
            setLoading(false);
            onFinalized();
            onClose();
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4">Asignar Proyecto: {project.npu}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Técnico Asignado</label>
                            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                {technicians.map(tech => (
                                    <div key={tech.id} className="flex items-center">
                                        <input
                                            type="radio"
                                            name="technician"
                                            id={tech.id}
                                            value={tech.id}
                                            checked={selectedTechnicianId === tech.id}
                                            onChange={(e) => setSelectedTechnicianId(e.target.value)}
                                            className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor={tech.id} className="ml-3 text-sm text-gray-700">{tech.nombreCompleto}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fecha Límite de Entrega (Interna)</label>
                            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} disabled={loading} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button onClick={handleSave} disabled={loading} className="bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded">{loading ? 'Asignando...' : 'Guardar Asignación'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const filteredProjects = projects.filter(p => 
        (p.npu && p.npu.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.clienteNombre && p.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.servicioNombre && p.servicioNombre.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const currentItems = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const formatDate = (timestamp) => {
        if (!timestamp) return '---';
        const date = timestamp.toDate();
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return adjustedDate.toLocaleDateString('es-MX', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    };

    const handleActivateProject = async (projectId) => {
        await updateDoc(doc(db, "proyectos", projectId), { estado: 'Activo', estadoCliente: 'Activo' });
    };

    const handleDeleteProject = async (projectId) => {
        await deleteDoc(doc(db, "proyectos", projectId));
        setConfirmingAction(null);
    };

    const promptDeleteProject = (projectId, projectNpu) => {
        setConfirmingAction({
            title: "Confirmar Eliminación",
            message: `¿Estás seguro de que quieres borrar el proyecto ${projectNpu}? Esta acción no se puede deshacer.`,
            onConfirm: () => handleDeleteProject(projectId),
            confirmText: "Sí, Borrar",
            confirmColor: "bg-red-600"
        });
    };

    return (
        <>
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
                <input 
                    type="text"
                    placeholder="Buscar por NPU, cliente, servicio o dependencia..."
                    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md mb-2 md:mb-0"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {userRole === 'supervisor' && supervisorView === 'new' && (
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Apertura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        )}

                        {userRole === 'supervisor' && supervisorView === 'assigned' && (
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Asignación</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Límite</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Info Ecotech</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado Entrega</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        )}

                        {userRole === 'administrador' && (
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Apertura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº Proy. Lab.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comentarios</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Prov.</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docs Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docs Proveedor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fact. Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fact. Proveedor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        )}
                    </thead>

                        <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(project => {

                            let deliveryStatus = 'A Tiempo';
                            if (userRole === 'supervisor' && supervisorView === 'assigned') {
                                const today = new Date(); today.setHours(0,0,0,0);
                                const dueDate = project.fechaEntregaInterna?.toDate();
                                if (!dueDate) {
                                    deliveryStatus = 'Sin Fecha';
                                } else {
                                    dueDate.setHours(0,0,0,0);
                                    if (dueDate < today) deliveryStatus = 'Atrasado';
                                }
                            }
                            const isEcotech = project.proveedorNombre?.toLowerCase().includes('ecotech');

                            return (
                                <tr key={project.id}>
                                    {userRole === 'supervisor' && supervisorView === 'new' && (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(project.fechaApertura)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{project.npu}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                                <button onClick={() => setNoteModalProject(project)} className="hover:text-blue-600 text-left w-full">
                                                    <p className="w-32 truncate" title={project.notasSupervisor || "Añadir nota"}>{project.notasSupervisor || <span className="text-gray-400 italic">Añadir nota...</span>}</p>
                                                </button>
                                            </td>
                                            <td className="px-4 py-2"><button onClick={() => { setModalProject(project); setModalType('assign'); }} className="text-indigo-600">Asignar</button></td>
                                        </>
                                    )}

                                    {userRole === 'supervisor' && supervisorView === 'assigned' && (
                                        <>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{project.npu}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{techniciansMap[project.asignadoTecnicosIds?.[0]] || '---'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDate(project.fechaAsignacionTecnico)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{formatDate(project.fechaEntregaInterna)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                                                {isEcotech ? (
                                                    <div className="text-xs">
                                                        <p><strong>Nº Proy:</strong> {project.numeroProyectoLaboratorio || 'N/A'}</p>
                                                        <p><strong>Puntos:</strong> {project.puntosDeTrabajo || 'N/A'}</p>
                                                        <p><strong>Estatus:</strong> {project.estatusEcotech || 'N/A'}</p>
                                                    </div>
                                                ) : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm"><StatusBadge status={deliveryStatus} /></td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                                <button onClick={() => setNoteModalProject(project)} className="hover:text-blue-600 text-left w-full">
                                                    <p className="w-32 truncate" title={project.notasSupervisor || "Añadir nota"}>{project.notasSupervisor || <span className="text-gray-400 italic">Añadir nota...</span>}</p>
                                                </button>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center space-x-4">
                                                    <button onClick={() => { setModalProject(project); setModalType('assign'); }} className="text-indigo-600">Reasignar</button>
                                                    <button onClick={() => { setModalProject(project); setModalType('log'); }} className="text-gray-600">Bitácora</button>
                                                </div>
                                            </td>
                                        </>
                                    )}

                                    {userRole === 'administrador' && (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(project.fechaApertura)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{project.npu}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.proveedorNombre}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{project.numeroProyectoLaboratorio || '---'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500" title={project.comentariosApertura}>
                                                <p className="w-32 truncate">{project.comentariosApertura || '---'}</p>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{project.poProveedor}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-green-600">${(project.precioCotizacionCliente || 0).toFixed(2)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">${(project.costoProveedor || 0).toFixed(2)}</td>
                                            <td className="px-4 py-2"><div className="flex space-x-2">{project.urlCotizacionCliente && <a href={project.urlCotizacionCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500">Cot</a>}{project.urlPOCliente && <a href={project.urlPOCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500">PO</a>}</div></td>
                                            <td className="px-4 py-2"><div className="flex space-x-2">{project.urlCotizacionProveedor && <a href={project.urlCotizacionProveedor} target="_blank" rel="noopener noreferrer" className="text-blue-500">Cot</a>}{project.urlPOProveedor && <a href={project.urlPOProveedor} target="_blank" rel="noopener noreferrer" className="text-blue-500">PO</a>}</div></td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{invoicesMap[project.facturaClienteId] || '---'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{invoicesMap[project.facturaProveedorId] || (project.proveedorNombre?.toLowerCase().trim() === "ecologia y asesoria ambiental" ? 'N/A' : '---')}</td>
                                            <td className="px-4 py-2"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${project.estado === 'Activo' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>{project.estado}</span></td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center space-x-4">
                                                    {project.estado === 'Cotización' && <button onClick={() => handleActivateProject(project.id)} className="text-green-600">Activar</button>}
                                                    <button onClick={() => { setModalProject(project); setModalType('manage'); }} className="text-indigo-600">Gestionar</button>
                                                    {project.estado !== 'Terminado' && project.estado !== 'Archivado' && <button onClick={() => promptDeleteProject(project.id, project.npu)} className="text-red-600">Borrar</button>}
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <div>
                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white mr-2 disabled:opacity-50">Anterior</button>
                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Siguiente</button>
                </div>
            </div>
            {modalProject && modalType === 'assign' && <AssignProjectModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={onUpdateProject} />}
            {modalProject && modalType === 'manage' && <ManageProjectModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={onUpdateProject} />}
            {modalProject && modalType === 'log' && <ProjectLogModal project={modalProject} user={user} userData={userData} onClose={() => setModalProject(null)} />}
            {noteModalProject && <SupervisorNoteModal project={noteModalProject} onClose={() => setNoteModalProject(null)} onUpdate={onUpdateProject} />}
            {confirmingAction && (
                <ConfirmationModal 
                    title={confirmingAction.title}
                    message={confirmingAction.message}
                    onConfirm={confirmingAction.onConfirm}
                    onCancel={() => setConfirmingAction(null)}
                    confirmText={confirmingAction.confirmText}
                    confirmColor={confirmingAction.confirmColor}
                />
            )}
        </>
    );
};

const ReviewProjectsTable = ({ projects, onUpdateProject }) => {
    const [confirmingAction, setConfirmingAction] = useState(null);

    const handleApprove = async () => {
        if (!confirmingAction || confirmingAction.action !== 'approve') return;
        
        const { project } = confirmingAction.payload;
        const projectRef = doc(db, "proyectos", project.id);
        const isFinalDelivery = !!project.urlDocumento2;

        try {
            if (isFinalDelivery) {
                if (project.faseFacturacion === 'Preliminar' || project.faseFacturacion === 'Fase 2 Pendiente') {
                    await updateDoc(projectRef, { estado: 'Archivado', estadoCliente: 'Terminado' });
                } else {
                    await updateDoc(projectRef, { estado: 'Pendiente de Factura', estadoCliente: 'Terminado' });
                }
            } else {
                await updateDoc(projectRef, { estado: 'Pendiente de Factura', faseFacturacion: 'Preliminar' });
            }
        } catch (error) {
            console.error("Error al aprobar proyecto:", error);
            alert("Ocurrió un error al aprobar el proyecto.");
        } finally {
            setConfirmingAction(null); 
            onUpdateProject();
        }
    };

    const handleReject = async (reason) => {
        if (!confirmingAction || confirmingAction.action !== 'reject') return;
        
        if (!reason || reason.trim() === '') {
            alert("El motivo del rechazo no puede estar vacío.");
            return; 
        }

        const { projectId } = confirmingAction.payload; 
        const projectRef = doc(db, "proyectos", projectId);
        
        try {
            await updateDoc(projectRef, { estado: 'Terminado Internamente', motivoRechazo: reason });
        } catch (error) {
            console.error("Error al rechazar proyecto:", error);
            alert("Ocurrió un error al rechazar el proyecto.");
        } finally {
            setConfirmingAction(null); 
            onUpdateProject(); 
        }
    };

    const promptApprove = (project) => {
        const isFinalDelivery = !!project.urlDocumento2;
        const hasBeenBilled = project.faseFacturacion === 'Preliminar' || project.faseFacturacion === 'Fase 2 Pendiente';
        
        const confirmationMessage = isFinalDelivery 
            ? (hasBeenBilled ? "Aprobar y finalizar este proyecto? Se archivará y no se volverá a facturar." : "Aprobar esta entrega final y enviarla a facturación?")
            : "Aprobar esta entrega preliminar y enviarla a facturación?";
        
        setConfirmingAction({
            action: 'approve',
            payload: { project },
            title: "Confirmar Aprobación",
            message: confirmationMessage,
        });
    };

    const promptReject = (projectId) => {
        setConfirmingAction({
            action: 'reject',
            payload: { projectId }, 
            title: "Rechazar Proyecto",
            message: "Por favor, introduce el motivo del rechazo para notificar al practicante.",
            confirmText: "Rechazar",
            confirmColor: "bg-orange-600"
        });
    };

    return (
        <>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos Finales</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {projects.map(project => (
                             <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.npu}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="flex flex-col space-y-1">
                                        {project.urlHeyzine && <a href={project.urlHeyzine} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Proyecto (Heyzine)</a>}
                                        {project.urlNotaPdf1 && <a href={project.urlNotaPdf1} target="_blank" rel="noopener noreferrer" className="text-red-600">Ver Nota 1</a>}
                                        {project.urlNotaPdf2 && <a href={project.urlNotaPdf2} target="_blank" rel="noopener noreferrer" className="text-red-600">Ver Nota 2</a>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex space-x-4">
                                        <button onClick={() => promptApprove(project)} className="text-green-600 hover:text-green-900">Aprobar</button>
                                        <button onClick={() => promptReject(project.id)} className="text-orange-600 hover:text-orange-900">Rechazar</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {confirmingAction?.action === 'approve' && (
                <ConfirmationModal 
                    title={confirmingAction.title}
                    message={confirmingAction.message}
                    onConfirm={handleApprove} 
                    onCancel={() => setConfirmingAction(null)}
                />
            )}
            
            {confirmingAction?.action === 'reject' && (
                <ActionWithReasonModal 
                    title={confirmingAction.title}
                    message={confirmingAction.message}
                    onConfirm={handleReject} 
                    onCancel={() => setConfirmingAction(null)}
                    confirmText={confirmingAction.confirmText}
                    confirmColor={confirmingAction.confirmColor}
                />
            )}
        </>
    );
};

const ClientProjectsList = ({ projects, onOpenModal }) => {
    const [activeAccordion, setActiveAccordion] = useState(null);
    const groupedProjects = projects.reduce((acc, project) => {
        const key = project.dependencia || 'Sin Dependencia';
        if (!acc[key]) acc[key] = [];
        acc[key].push(project);
        return acc;
    }, {});

    const toggleAccordion = (key) => setActiveAccordion(activeAccordion === key ? null : key);
    const formatDate = (timestamp) => !timestamp ? '---' : new Date(timestamp.seconds * 1000).toLocaleDateString('es-MX');
    const getStatusClass = (estado) => estado === 'Activo' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';

    return (
        <div className="space-y-4">
            {Object.entries(groupedProjects).map(([dependencia, projs]) => (
                <div key={dependencia} className="bg-white rounded-lg shadow overflow-hidden">
                    <button onClick={() => toggleAccordion(dependencia)} className="w-full p-4 text-left font-bold text-lg text-gray-800 flex justify-between items-center hover:bg-gray-50 transition">
                        <span>{dependencia} <span className="text-sm font-normal text-gray-500">({projs.length})</span></span>
                        <span className={`transform transition-transform duration-300 ${activeAccordion === dependencia ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {activeAccordion === dependencia && (
                        <ul className="divide-y divide-gray-200 border-t">
                            {projs.map(project => (
                                <li key={project.id} className="p-4 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center">
                                    <div className="flex-1 mb-4 md:mb-0"><div className="text-sm font-medium text-gray-900">{project.servicioNombre}</div></div>
                                    <div className="w-full md:w-40 mb-4 md:mb-0"><div className="text-sm text-gray-500 hidden md:block">{formatDate(project.fechaApertura)}</div></div>
                                    <div className="w-full md:w-40 mb-4 md:mb-0"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(project.estadoCliente)}`}>{project.estadoCliente}</span></div>
                                    <div className="w-full md:w-56 flex items-center space-x-4">
                                        {project.urlHeyzine && <button onClick={() => onOpenModal(project.urlHeyzine)} className="text-sm font-medium text-blue-600 hover:text-blue-900">Ver Proyecto</button>}
                                        {project.urlNotaPdf1 && <a href={project.urlNotaPdf1} download className="text-sm font-medium text-red-600 hover:text-red-900">Nota 1</a>}
                                        {project.urlNotaPdf2 && <a href={project.urlNotaPdf2} download className="text-sm font-medium text-red-600 hover:text-red-900">Nota 2</a>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ))}
        </div>
    );
};

// El dashboard del Cliente. Contiene la estantería visual y la lista detallada de sus proyectos.
const ClientDashboard = ({ user, userData }) => {
    const [projects, setProjects] = useState([]);
    const [shelfProjects, setShelfProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clientView, setClientView] = useState('shelf');
    const [modalUrl, setModalUrl] = useState(null);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        
        const q = query(
            collection(db, "proyectos"), 
            where("clienteId", "==", user.uid),
            where("estadoCliente", "in", ["Activo", "Terminado"])
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            projectsData.sort((a, b) => (b.fechaApertura?.seconds || 0) - (a.fechaApertura?.seconds || 0));
            setProjects(projectsData);

            const latestProjectsMap = new Map();

            projectsData.forEach(project => {
                if (project.estadoCliente === 'Terminado' && project.urlHeyzine) {
                    const serviceId = project.servicioId;
                    const existingProject = latestProjectsMap.get(serviceId);

                    if (!existingProject || (project.fechaApertura?.seconds > existingProject.fechaApertura?.seconds)) {
                        latestProjectsMap.set(serviceId, project);
                    }
                }
            });

            setShelfProjects(Array.from(latestProjectsMap.values()));

            setLoading(false);
        }, (error) => {
            console.error("Error fetching client projects: ", error);
            if (error.code === 'failed-precondition') {
                console.error("IMPORTANTE: Se requiere un índice compuesto en Firestore. Ve a la URL que aparece en el mensaje de error en la consola para crearlo con un solo clic.");
            }
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [user]);

    return (
        <>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Proyectos de {userData.nombreCompleto}</h1>
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setClientView('shelf')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${clientView === 'shelf' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Estantería de Proyectos
                    </button>
                    <button onClick={() => setClientView('list')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${clientView === 'list' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Lista Detallada
                    </button>
                </nav>
            </div>
            
            {loading ? (
                <p>Cargando proyectos...</p>
            ) : projects.length === 0 ? (
                <p className="text-center text-gray-500 mt-8">No hay proyectos para mostrar.</p>
            ) : clientView === 'shelf' ? (
                <ProjectsShelf projects={shelfProjects} onOpenModal={setModalUrl} />
            ) : (
                <ClientProjectsList projects={projects} onOpenModal={setModalUrl} />
            )}

            {modalUrl && <HeyzineViewerModal url={modalUrl} onClose={() => setModalUrl(null)} />}
        </>
    );
};

 //Componente para renderizar la gráfica de Pipeline de Proyectos.
 //Recibe los datos ya procesados y listos para mostrar.
const PipelineChart = ({ chartData }) => {
    const data = {
        labels: chartData.labels,
        datasets: [
            {
                label: 'Valor en Cotización',
                data: chartData.cotizacionData,
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
            },
            {
                label: 'Valor Activo',
                data: chartData.activoData,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
            },
            {
                label: 'Valor Pdto. Factura',
                data: chartData.pendienteFacturaData,
                backgroundColor: 'rgba(255, 206, 86, 0.7)', 
            },
            {
                type: 'line', 
                label: 'Valor Total Ofertado',
                data: chartData.totalData,
                borderColor: 'rgba(75, 192, 192, 1)', 
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                tension: 0.2,
                yAxisID: 'y1',
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: false,
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
            legend: {
                position: 'bottom',
            }
        },
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
                beginAtZero: true
            },
            y1: {
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                },
                beginAtZero: true,
            }
        },
    };

    return <Bar options={options} data={data} />;
};

//Componente para la gráfica de Salud de Cuentas por Cobrar.
const AccountsReceivableChart = ({ chartData }) => {
    const data = {
        labels: chartData.labels,
        datasets: [
            {
                label: 'Pagado',
                data: chartData.pagadoData,
                backgroundColor: 'rgba(75, 192, 192, 0.7)', 
            },
            {
                label: 'Programado a Pago',
                data: chartData.programadoData,
                backgroundColor: 'rgba(54, 162, 235, 0.7)', 
            },
            {
                label: 'Vence Hoy',
                data: chartData.venceHoyData,
                backgroundColor: 'rgba(255, 159, 64, 0.7)', 
            },
            {
                label: 'Vencido',
                data: chartData.vencidoData,
                backgroundColor: 'rgba(255, 99, 132, 0.7)', 
            },
            {
                label: 'Pdte. de Programación',
                data: chartData.pdteProgramacionData,
                backgroundColor: 'rgba(201, 203, 207, 0.7)', 
            },
            {
                type: 'line',
                label: 'Total Facturado',
                data: chartData.totalFacturadoData,
                borderColor: '#36A2EB',
                tension: 0.2,
                yAxisID: 'y1',
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: { display: false },
            tooltip: { mode: 'index', intersect: false },
            legend: { position: 'bottom' }
        },
        scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true },
            y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                beginAtZero: true,
            }
        },
    };

    return <Bar options={options} data={data} />;
};

//Componente para la gráfica de Flujo de Caja Proyectado (Semanal).
const CashFlowChart = ({ chartData }) => {
    const data = {
        labels: chartData.labels,
        datasets: [
            {
                label: 'Ingresos Programados',
                data: chartData.ingresosData,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                type: 'bar', 
            },
            {
                label: 'Egresos Programados',
                data: chartData.egresosData,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                type: 'bar', 
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: { display: false },
            legend: { position: 'bottom' }
        },
        scales: {
            y: { beginAtZero: true }
        }
    };

    return <Bar options={options} data={data} />;
};

//Componente para la gráfica de Productividad por Técnico. 
const TechnicianProductivityChart = ({ chartData }) => {
    const data = {
        labels: chartData.labels,
        datasets: [
            {
                label: 'Proyectos Entregados (Mes Actual)',
                data: chartData.completedData, 
                backgroundColor: 'rgba(153, 102, 255, 0.7)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
            },
        ],
    };

    const options = {
        indexAxis: 'y', 
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false, 
            },
            title: {
                display: false,
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                }
            }
        }
    };

    return <Bar options={options} data={data} />;
};

// El widget que muestra un KPI en el dashboard directivo.
const KPIWidget = ({ title, value, unit = '', trend = null }) => {
    return (
        <div className="bg-white p-5 rounded-xl shadow-md">
            <h3 className="font-bold text-gray-500 truncate">{title}</h3>
            <p className="text-3xl font-bold mt-2">
                {value}
                <span className="text-xl font-semibold ml-1">{unit}</span>
            </p>
        </div>
    );
};


const StatusBadge = ({ status }) => {
    const statusStyles = {
        'Atrasado': 'bg-red-100 text-red-800',
        'Por Vencer': 'bg-orange-100 text-orange-800',
        'A Tiempo': 'bg-green-100 text-green-800',
        'Sin Fecha': 'bg-gray-100 text-gray-600',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
};

const OperationalTrackingTable = ({ projects, techniciansMap }) => {
    const formatDate = (timestamp) => {
        if (!timestamp) return '---';
        const date = timestamp.toDate();
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return adjustedDate.toLocaleDateString('es-MX', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    };

    return (
        <div className="overflow-x-auto bg-white rounded-lg shadow mt-6">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planta/Ubicación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Técnico</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Asignación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Límite</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas del Supervisor</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {projects.map(project => (
                        <tr key={project.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={project.status} /></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{project.ubicacionCliente || project.clienteNombre}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{project.servicioNombre}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{techniciansMap[project.asignadoTecnicosIds?.[0]] || 'No asignado'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(project.fechaAsignacionTecnico)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(project.fechaEntregaInterna)}</td>
                            <td className="px-6 py-4 text-sm text-gray-600" title={project.notasSupervisor}>
                                <p className="w-48 truncate">{project.notasSupervisor || '---'}</p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// El dashboard Directivo. Muestra las gráficas y KPIs
// sobre la salud del negocio que construimos.
const DirectivoDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboardData, setDashboardData] = useState(null);
    const [view, setView] = useState('kpis');
    const [opSortBy, setOpSortBy] = useState('sortOrder');
    const [opSortOrder, setOpSortOrder] = useState('asc');

    /**
     * @param {Array} projects
     * @param {Array} invoices
     * @returns {Object}
     */


    const processDataForDashboard = (projects, invoices, technicians, sortBy, sortOrder) => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneDay = 1000 * 60 * 60 * 24;

        const monthlyProjectsData = Array(12).fill(0).map(() => ({ cotizacion: 0, activo: 0, pendienteFactura: 0, total: 0 }));
        projects.forEach(p => {
            if (p.fechaApertura?.toDate && p.fechaApertura.toDate().getFullYear() === currentYear) {
                const month = p.fechaApertura.toDate().getMonth();
                const projectValue = p.precioCotizacionCliente || 0;
                monthlyProjectsData[month].total += projectValue;
                switch (p.estado) {
                    case 'Cotización': monthlyProjectsData[month].cotizacion += projectValue; break;
                    case 'Activo': case 'Terminado Internamente': case 'En Revisión Final': monthlyProjectsData[month].activo += projectValue; break;
                    case 'Pendiente de Factura': monthlyProjectsData[month].pendienteFactura += projectValue; break;
                    default: break;
                }
            }
        });

        const monthlyARData = Array(12).fill(0).map(() => ({ totalFacturado: 0, pdteProgramacion: 0, programado: 0, venceHoy: 0, vencido: 0, pagado: 0 }));
        invoices.forEach(inv => {
            if (inv.tipo === 'cliente' && inv.fechaEmision?.toDate && inv.fechaEmision.toDate().getFullYear() === currentYear) {
                const month = inv.fechaEmision.toDate().getMonth();
                const invoiceValue = inv.monto || 0;
                monthlyARData[month].totalFacturado += invoiceValue;
                if (inv.estado === 'Pagada') { monthlyARData[month].pagado += invoiceValue; }
                else if (inv.estado === 'Pendiente') {
                    if (inv.fechaPromesaPago?.toDate) {
                        const promiseDate = inv.fechaPromesaPago.toDate();
                        promiseDate.setHours(0, 0, 0, 0);
                        if (promiseDate < today) { monthlyARData[month].vencido += invoiceValue; }
                        else if (promiseDate.getTime() === today.getTime()) { monthlyARData[month].venceHoy += invoiceValue; }
                        else { monthlyARData[month].programado += invoiceValue; }
                    } else { monthlyARData[month].pdteProgramacion += invoiceValue; }
                }
            }
        });

        const weeklyCashFlowData = Array(8).fill(0).map(() => ({ ingresos: 0, egresos: 0 }));
        const weeklyLabels = [];
        const todayForWeeks = new Date();
        for (let i = 0; i < 8; i++) {
            const weekStartDate = new Date(todayForWeeks.getTime() + (i * 7 * oneDay));
            weeklyLabels.push(`Sem ${i + 1} (${weekStartDate.getDate()}/${weekStartDate.getMonth() + 1})`);
        }
        invoices.forEach(inv => {
            if (inv.estado === 'Pendiente' && inv.fechaPromesaPago?.toDate) {
                const promiseDate = inv.fechaPromesaPago.toDate();
                const diffDays = Math.floor((promiseDate - todayForWeeks) / oneDay);
                const weekIndex = Math.floor(diffDays / 7);
                if (weekIndex >= 0 && weekIndex < 8) {
                    if (inv.tipo === 'cliente') { weeklyCashFlowData[weekIndex].ingresos += inv.monto || 0; }
                    else if (inv.tipo === 'proveedor') { weeklyCashFlowData[weekIndex].egresos += inv.monto || 0; }
                }
            }
        });

        const techProductivity = {};
        technicians.forEach(t => { techProductivity[t.id] = { name: t.nombreCompleto.split(' ')[0], completed: 0 }; });
        projects.forEach(p => {
            [p.fechaFinTecnico1, p.fechaFinTecnico2].filter(Boolean).forEach(timestamp => {
                const completionDate = timestamp.toDate();
                if (completionDate.getMonth() === currentMonth && completionDate.getFullYear() === currentYear) {
                    (p.asignadoTecnicosIds || []).forEach(techId => {
                        if (techProductivity[techId]) { techProductivity[techId].completed += 1; }
                    });
                }
            });
        });

        let totalMargin = 0, projectsWithFinancials = 0;
        let totalDeliveryDays = 0, completedProjects = 0;
        let totalActivationDays = 0, activatedProjects = 0;

        projects.forEach(p => {
            if ((p.precioCotizacionCliente || 0) > 0 && (p.costoProveedor || 0) >= 0) {
                totalMargin += (p.precioCotizacionCliente - p.costoProveedor) / p.precioCotizacionCliente;
                projectsWithFinancials++;
            }
            if (p.fechaAsignacionTecnico?.toDate && p.fechaFinTecnico1?.toDate) {
                totalDeliveryDays += (p.fechaFinTecnico1.toDate() - p.fechaAsignacionTecnico.toDate()) / oneDay;
                completedProjects++;
            }
            if (p.fechaApertura?.toDate && p.fechaAsignacionTecnico?.toDate) {
                totalActivationDays += (p.fechaAsignacionTecnico.toDate() - p.fechaApertura.toDate()) / oneDay;
                activatedProjects++;
            }
        });

        const kpis = {
            avgMargin: projectsWithFinancials > 0 ? ((totalMargin / projectsWithFinancials) * 100).toFixed(1) : 0,
            avgDeliveryDays: completedProjects > 0 ? (totalDeliveryDays / completedProjects).toFixed(1) : 0,
            avgActivationDays: activatedProjects > 0 ? (totalActivationDays / activatedProjects).toFixed(1) : 0,
            invoicedThisMonth: (monthlyARData[currentMonth].totalFacturado).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
        };

        today.setHours(0, 0, 0, 0);

        const activeProjects = projects.filter(p => p.estado === "Activo");

        const operationalProjects = activeProjects.map(p => {
            let status = 'A Tiempo';
            let sortOrder = 3;
            const dueDate = p.fechaEntregaInterna?.toDate();

            if (!dueDate) {
                status = 'Sin Fecha';
                sortOrder = 4;
            } else {
                dueDate.setHours(0, 0, 0, 0);
                const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);
                if (diffDays < 0) {
                    status = 'Atrasado';
                    sortOrder = 1;
                } else if (diffDays <= 3) {
                    status = 'Por Vencer';
                    sortOrder = 2;
                }
            }
            return { ...p, status, sortOrder };
        });

        operationalProjects.sort((a, b) => {
            let fieldA = a[sortBy];
            let fieldB = b[sortBy];

            if (sortBy.includes('fecha')) {
                fieldA = a[sortBy]?.toDate() || (sortOrder === 'asc' ? new Date('2999-12-31') : new Date(0));
                fieldB = b[sortBy]?.toDate() || (sortOrder === 'asc' ? new Date('2999-12-31') : new Date(0));
            }

            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        const techniciansMap = {};
        technicians.forEach(t => {
            techniciansMap[t.id] = t.nombreCompleto;
        });

        return {
            kpis,
            pipeline: { labels, cotizacionData: monthlyProjectsData.map(m => m.cotizacion), activoData: monthlyProjectsData.map(m => m.activo), pendienteFacturaData: monthlyProjectsData.map(m => m.pendienteFactura), totalData: monthlyProjectsData.map(m => m.total) },
            accountsReceivable: { labels, totalFacturadoData: monthlyARData.map(m => m.totalFacturado), pagadoData: monthlyARData.map(m => m.pagado), programadoData: monthlyARData.map(m => m.programado), venceHoyData: monthlyARData.map(m => m.venceHoy), vencidoData: monthlyARData.map(m => m.vencido), pdteProgramacionData: monthlyARData.map(m => m.pdteProgramacion) },
            cashFlow: { labels: weeklyLabels, ingresosData: weeklyCashFlowData.map(w => w.ingresos), egresosData: weeklyCashFlowData.map(w => w.egresos) },
            technicianProductivity: { labels: Object.values(techProductivity).map(t => t.name), completedData: Object.values(techProductivity).map(t => t.completed) },
            operationalProjects,
            techniciansMap
        };
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const projectsQuery = query(collection(db, "proyectos"));
                const invoicesQuery = query(collection(db, "facturas"));
                const techniciansQuery = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));

                const [projectsSnapshot, invoicesSnapshot, techniciansSnapshot] = await Promise.all([
                    getDocs(projectsQuery),
                    getDocs(invoicesQuery),
                    getDocs(techniciansQuery)
                ]);

                const allProjects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const allInvoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const allTechnicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const processedData = processDataForDashboard(allProjects, allInvoices, allTechnicians, opSortBy, opSortOrder);
                setDashboardData(processedData);

            } catch (err) {
                console.error("Error al obtener datos para el dashboard directivo:", err);
                setError("No se pudieron cargar las métricas.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [opSortBy, opSortOrder]);

    if (loading) {
        return <div className="text-center py-10">Calculando métricas... ⚙️</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-600">{error}</div>;
    }


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Directivo</h1>
                <p className="text-gray-600">Vista general de la salud y rendimiento del negocio.</p>
            </div>
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setView('kpis')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'kpis' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Métricas y Finanzas
                    </button>
                    <button onClick={() => setView('operativo')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'operativo' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Seguimiento Operativo
                    </button>
                </nav>
            </div>

            {view === 'kpis' && (
                <>
                    {dashboardData?.kpis && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <KPIWidget title="Margen Promedio" value={dashboardData.kpis.avgMargin} unit="%" />
                            <KPIWidget title="Tiempo Prom. Entrega" value={dashboardData.kpis.avgDeliveryDays} unit="días" />
                            <KPIWidget title="Tiempo Prom. Activación" value={dashboardData.kpis.avgActivationDays} unit="días" />
                            <KPIWidget title="Facturado (Mes Actual)" value={dashboardData.kpis.invoicedThisMonth} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="font-bold text-lg mb-4">Pipeline de Proyectos (Mensual)</h3>
                            <div className="h-80">
                                {dashboardData?.pipeline && <PipelineChart chartData={dashboardData.pipeline} />}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="font-bold text-lg mb-4">Salud de Cuentas por Cobrar (Mensual)</h3>
                            <div className="h-80">
                                {dashboardData?.accountsReceivable && <AccountsReceivableChart chartData={dashboardData.accountsReceivable} />}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="font-bold text-lg mb-4">Flujo de Caja Proyectado (Próximas 8 Semanas)</h3>
                            <div className="h-80">
                                {dashboardData?.cashFlow && <CashFlowChart chartData={dashboardData.cashFlow} />}
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="font-bold text-lg mb-4">Productividad por Técnico (Mes Actual)</h3>
                            <div className="h-80">
                                {dashboardData?.technicianProductivity && <TechnicianProductivityChart chartData={dashboardData.technicianProductivity} />}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {view === 'operativo' && (
                <div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Proyectos Activos y Pendientes de Entrega</h2>
                            <p className="text-gray-600 mt-1">Lista ordenada de los proyectos en curso.</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <label className="text-sm font-medium">Ordenar por:</label>
                            <select value={opSortBy} onChange={e => setOpSortBy(e.target.value)} className="border-gray-300 rounded-md p-2 text-sm">
                                <option value="sortOrder">Criticidad</option>
                                <option value="fechaEntregaInterna">Fecha Límite</option>
                                <option value="fechaAsignacionTecnico">Fecha de Asignación</option>
                            </select>
                            <button onClick={() => setOpSortOrder(opSortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-md text-sm bg-white shadow-sm">
                                {opSortOrder === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
                            </button>
                        </div>
                    </div>
                
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Proyectos Activos y Pendientes de Entrega</h2>
                        <p className="text-gray-600 mt-1">Lista ordenada de más a menos crítico según su fecha límite.</p>
                        {dashboardData?.operationalProjects && (
                            <OperationalTrackingTable
                                projects={dashboardData.operationalProjects}
                                techniciansMap={dashboardData.techniciansMap}
                            />
                        )}
                    </div>
                </div>    
            )}
        </div>
    );
};

const EcotechDashboard = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = () => {
        setLoading(true);
        const q = query(
            collection(db, "proyectos"), 
            where("proveedorNombre", "==", "Ecotech Ingenieria del Medio Ambiente"),
            where("estado", "!=", "Terminado") 
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projects for Ecotech: ", error);
            if (error.code === 'failed-precondition') {
                alert("Se requiere una configuración adicional en la base de datos. Por favor, revise la consola del navegador (F12) para encontrar un enlace y crear el índice necesario.");
            }
            setLoading(false);
        });
        
        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchProjects();
        return () => unsubscribe();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestión de Proyectos Ecotech</h1>
            {loading ? (
                <p>Cargando proyectos de Ecotech...</p>
            ) : projects.length === 0 ? (
                 <p className="text-center text-gray-500 mt-8">No hay proyectos de Ecotech activos.</p>
            ) : (
                <EcotechProjectsTable projects={projects} onUpdateProject={fetchProjects} />
            )}
        </div>
    );
};

const EcotechProjectsTable = ({ projects, onUpdateProject }) => {
    const [modalProject, setModalProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const getProjectDisplayStatus = (project) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // El estado final 'Terminado' tiene la máxima prioridad.
        if (project.estatusEcotech === 'Terminado') {
            return { text: 'Terminado', class: 'bg-blue-100 text-blue-800' };
        }

        // Si se envió digitalmente, verificamos si está vencido el plazo del lab.
        if (project.fechaEnvioDigital?.toDate) {
            const deadlineLab = addBusinessDays(project.fechaEnvioDigital.toDate(), 15); // 3 semanas * 5 días hábiles
            if (today > deadlineLab) {
                return { text: 'Vencido Lab.', class: 'bg-red-100 text-red-800 font-bold' };
            }
            // Si no está vencido, mostramos el estado guardado.
            return { text: project.estatusEcotech, class: 'bg-green-100 text-green-800' };
        }

        // Si tiene fecha de muestreo, verificamos si está vencido internamente.
        if (project.fechaMuestreo?.toDate) {
            const deadlineInternal = addBusinessDays(project.fechaMuestreo.toDate(), 3);
            if (today > deadlineInternal) {
                return { text: 'Vencido Internamente', class: 'bg-orange-100 text-orange-800 font-semibold' };
            }
            // Si no está vencido, mostramos el estado guardado.
            return { text: project.estatusEcotech, class: 'bg-green-100 text-green-800' };
        }

        // Si no se cumple ninguna condición de tiempo, mostramos el estado guardado.
        return { text: project.estatusEcotech || 'Pendiente', class: 'bg-gray-100 text-gray-700' };
    };

    // --- Reemplazar el componente ManageEcotechProjectModal (dentro de EcotechProjectsTable) ---

    const ManageEcotechProjectModal = ({ project, onClose, onFinalized }) => {
        const [labProjectNumber, setLabProjectNumber] = useState(project.numeroProyectoLaboratorio || '');
        const [workPoints, setWorkPoints] = useState(project.puntosDeTrabajo || '');
        const [notes, setNotes] = useState(project.notasEcotech || '');
        const [guiaEnvio, setGuiaEnvio] = useState(project.numeroGuiaEnvio || '');
        const [guiaRegreso, setGuiaRegreso] = useState(project.numeroGuiaRegreso || '');
        // NUEVO: Estado para la nueva fecha de muestreo
        const [fechaMuestreo, setFechaMuestreo] = useState('');
        const [loading, setLoading] = useState(false);

        // Función genérica para guardar cambios
        const handleUpdate = async (updateData) => {
            setLoading(true);
            const projectRef = doc(db, "proyectos", project.id);
            try {
                await updateDoc(projectRef, updateData);
                onFinalized();
                onClose();
            } catch (err) {
                alert("Error al guardar los cambios.");
            } finally {
                setLoading(false);
            }
        };

        // Acciones específicas del flujo de trabajo
        const handleStart = () => handleUpdate({ estatusEcotech: 'Pend. No de proyecto' });
        const handleSaveSamplingDate = () => handleUpdate({ estatusEcotech: 'En Proceso', fechaMuestreo: Timestamp.fromDate(new Date(fechaMuestreo)) });
        const handleSendDigital = () => handleUpdate({ estatusEcotech: 'Enviado Dig.', fechaEnvioDigital: Timestamp.now() });
        const handleSaveGuides = () => handleUpdate({ numeroGuiaEnvio: guiaEnvio, numeroGuiaRegreso: guiaRegreso, estatusEcotech: 'Terminado' });

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-2">Gestionar Proyecto Ecotech: {project.npu}</h3>
                    <p className="text-sm text-gray-500 mb-6">Estado actual: <span className="font-bold">{project.estatusEcotech || 'Pendiente'}</span></p>
                    
                    {/* --- ACCIONES CONTEXTUALES --- */}
                    {project.estatusEcotech === 'Pendiente' && (
                        <button onClick={handleStart} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mb-4">Empezar Tarea</button>
                    )}
                    {project.estatusEcotech === 'Pend. No de proyecto' && (
                        <div className="p-4 border rounded-md bg-gray-50 mb-4">
                            <label className="block text-sm font-medium text-gray-700">Introduce la Fecha de Muestreo</label>
                            <input type="date" value={fechaMuestreo} onChange={e => setFechaMuestreo(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                            <button onClick={handleSaveSamplingDate} disabled={!fechaMuestreo} className="w-full mt-3 bg-blue-600 text-white font-bold py-2 rounded-lg disabled:bg-gray-400">Guardar Fecha y Poner "En Proceso"</button>
                        </div>
                    )}
                    {project.estatusEcotech === 'En Proceso' && (
                        <button onClick={handleSendDigital} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mb-4">Marcar como "Enviado Digitalmente"</button>
                    )}

                    {/* --- FORMULARIO GENERAL (siempre visible) --- */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Número de Proyecto (Laboratorio)</label>
                            <input type="text" value={labProjectNumber} onChange={e => setLabProjectNumber(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Puntos de Trabajo</label>
                            <input type="number" value={workPoints} onChange={e => setWorkPoints(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nº de Guía (Envío)</label>
                            <input type="text" value={guiaEnvio} onChange={e => setGuiaEnvio(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nº de Guía (Regreso)</label>
                            <input type="text" value={guiaRegreso} onChange={e => setGuiaRegreso(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Notas</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border rounded-md"></textarea>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button onClick={handleSaveGuides} className="bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar y Marcar como Terminado'}</button>
                    </div>
                </div>
            </div>
        );
    };
    
    const filteredProjects = projects.filter(project => 
        (project.npu && project.npu.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.clienteNombre && project.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.servicioNombre && project.servicioNombre.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredProjects.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <>
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
                <input 
                    type="text"
                    placeholder="Buscar por NPU, cliente o servicio..."
                    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md mb-2 md:mb-0"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº Proyecto Lab.</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Puntos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guía Envío</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guía Regreso</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estatus Interno</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(project => {
                            const displayStatus = getProjectDisplayStatus(project);
                            return (
                                <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.npu}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.numeroProyectoLaboratorio || '---'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.puntosDeTrabajo || '---'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500" title={project.notasEcotech}>
                                    <p className="w-40 truncate">{project.notasEcotech || '---'}</p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.numeroGuiaEnvio || '---'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.numeroGuiaRegreso || '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${displayStatus.class}`}>
                                            {displayStatus.text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => setModalProject(project)} className="text-indigo-600 hover:text-indigo-900">Gestionar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <div>
                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white mr-2 disabled:opacity-50">Anterior</button>
                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Siguiente</button>
                </div>
            </div>
            
            {modalProject && <ManageEcotechProjectModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={onUpdateProject} />}
        </>
    );
};

// Componente para agregar tabla de proyectos terminados al dashboard del supervisor
const DeliveredProjectsTable = ({ projects }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const formatDate = (timestamp) => {
        if (!timestamp) return '---';
        const date = timestamp.toDate();
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return adjustedDate.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const filteredProjects = projects.filter(p =>
        (p.npu && p.npu.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.clienteNombre && p.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.servicioNombre && p.servicioNombre.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredProjects.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="mt-6">
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
                <input
                    type="text"
                    placeholder="Buscar por NPU, cliente o servicio..."
                    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md mb-2 md:mb-0"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha de Entrega</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(project => (
                            <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.npu}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{project.clienteNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{project.servicioNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(project.fechaFinTecnico2 || project.fechaFinTecnico1)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                    {(project.urlNotaPdf2 || project.urlNotaPdf1) && <a href={project.urlNotaPdf2 || project.urlNotaPdf1} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-800">Nota</a>}
                                    {project.urlHeyzine && <a href={project.urlHeyzine} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Documento</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <div>
                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white mr-2 disabled:opacity-50">Anterior</button>
                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Siguiente</button>
                </div>
            </div>
        </div>
    );
};

// El dashboard del Supervisor. Aquí ve los proyectos nuevos para asignar
// y monitorea el progreso de los que ya están en proceso.
// y los proyectos terminados tambien 

const SupervisorDashboard = ({ user, userData }) => {
    const [view, setView] = useState('new');
    const [allProjects, setAllProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('fechaEntregaInterna'); 
    const [sortOrder, setSortOrder] = useState('asc'); 

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "proyectos"), where("estado", "!=", "Cotización"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setAllProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const { newProjects, assignedProjects, deliveredProjects } = React.useMemo(() => {
        const newP = [];
        let assignedP = [];
        const deliveredP = [];

        allProjects.forEach(p => {
            if (p.fechaFinTecnico1) {
                deliveredP.push(p);
            }
            if (p.estado === 'Activo') {
                const hasAssignedTechnicians = p.asignadoTecnicosIds && p.asignadoTecnicosIds.length > 0;
                if (hasAssignedTechnicians) {
                    assignedP.push(p);
                } else {
                    newP.push(p);
                }
            }
        });
        
        assignedP.sort((a, b) => {
            const fieldA = a[sortBy]?.toDate() || new Date(0);
            const fieldB = b[sortBy]?.toDate() || new Date(0);
            
            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return { newProjects: newP, assignedProjects: assignedP, deliveredProjects: deliveredP };
    }, [allProjects, sortBy, sortOrder]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Panel de Supervisión</h1>
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setView('new')} className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'new' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Nuevos por Asignar
                        {newProjects.length > 0 && <span className="absolute top-2 -right-4 ml-2 px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{newProjects.length}</span>}
                    </button>
                    <button onClick={() => setView('assigned')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'assigned' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Asignados y en Proceso</button>
                    <button onClick={() => setView('delivered')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'delivered' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Entregados
                    </button>
                </nav>
            </div>
            
            {loading ? <p>Cargando proyectos...</p> : (
                <>
                    {view === 'assigned' && (
                        <div className="flex justify-end items-center mb-4 space-x-4">
                            <label htmlFor="sort-by" className="text-sm font-medium text-gray-700">Ordenar por:</label>
                            <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value)} className="border-gray-300 rounded-md shadow-sm p-2 text-sm">
                                <option value="fechaEntregaInterna">Fecha Límite</option>
                                <option value="fechaAsignacionTecnico">Fecha de Asignación</option>
                            </select>
                            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-md text-sm bg-white shadow-sm hover:bg-gray-50">
                                {sortOrder === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
                            </button>
                        </div>
                    )}

                    {view === 'new' && <ProjectsTable projects={newProjects} onUpdateProject={() => {}} userRole="supervisor" supervisorView="new" user={user} userData={userData} />}
                    {view === 'assigned' && <ProjectsTable projects={assignedProjects} onUpdateProject={() => {}} userRole="supervisor" supervisorView="assigned" user={user} userData={userData} />}
                    {view === 'delivered' && <DeliveredProjectsTable projects={deliveredProjects} />}
                </>
            )}
        </div>
    );
};

// El dashboard del Técnico. Su lista de tareas pendientes y en proceso.
// Desde aquí empieza a trabajar, usa la bitácora y finaliza sus tareas.
const TecnicoDashboard = ({ user, userData, selectedRole }) => {
    const [view, setView] = useState('new');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('fechaEntregaInterna');
    const [sortOrder, setSortOrder] = useState('asc');

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        
        const statusToQuery = view === 'new' ? "No Visto" : "En Proceso";
        
        const q = query(
            collection(db, "proyectos"),
            where("estado", "==", "Activo"),
            where(`tecnicosStatus.${user.uid}`, "==", statusToQuery)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching projects for tecnico in view ${view}:`, error);
            if (error.code === 'failed-precondition') {
                alert("Se requiere una configuración adicional en la base de datos. Por favor, revise la consola del navegador (F12) para encontrar un enlace y crear el índice necesario.");
            }
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [view, user]);

    const sortedProjects = React.useMemo(() => {
        const sortable = [...projects];
        sortable.sort((a, b) => {
            const fieldA = a[sortBy]?.toDate() || new Date('2999-12-31');
            const fieldB = b[sortBy]?.toDate() || new Date('2999-12-31');
            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sortable;
    }, [projects, sortBy, sortOrder]);
    

    const handleStartProject = async (project) => {
        const projectRef = doc(db, "proyectos", project.id);
        await updateDoc(projectRef, {
            [`tecnicosStatus.${user.uid}`]: "En Proceso"
        });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Mis Tareas</h1>
                <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium">Ordenar por:</label>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border-gray-300 rounded-md p-2 text-sm">
                        <option value="fechaEntregaInterna">Fecha Límite</option>
                    </select>
                    <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-md text-sm bg-white shadow-sm">
                        {sortOrder === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
                    </button>
                </div>
            </div>
            
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setView('new')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'new' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Nuevas Tareas</button>
                    <button onClick={() => setView('inProgress')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'inProgress' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Tareas en Proceso</button>
                </nav>
            </div>

            {loading ? <p>Cargando tareas...</p> : (
                <TecnicoProjectsTable
                    projects={sortedProjects}
                    onUpdateProject={() => {}}
                    user={user}
                    userData={userData}
                    handleStartProject={handleStartProject}
                    selectedRole={selectedRole}
                />
            )}
        </div>
    );
};

const TecnicoProjectsTable = ({ projects, onUpdateProject, user, userData, handleStartProject, selectedRole }) => {
    const [modalProject, setModalProject] = useState(null);
    const [modalType, setModalType] = useState(''); // 'task' o 'log'

    const ManageTaskModal = ({ project, onClose, onFinalized }) => {
        const [comments, setComments] = useState('');
        const [evidenceFile, setEvidenceFile] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');

        const handleFileChange = (e) => {
            if (e.target.files[0]) {
                setEvidenceFile(e.target.files[0]);
            }
        };

        const generateAndSaveNota = async () => {
            if (typeof window.jspdf === 'undefined') {
                throw new Error("La librería para generar PDFs (jsPDF) no se ha cargado.");
            }
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF();
            const anioActual = new Date().getFullYear();
            const contadorRef = doc(db, "contadores", `notas_entrega_${anioActual}`);
            
            const nuevoConsecutivo = await runTransaction(db, async (transaction) => {
                const contadorDoc = await transaction.get(contadorRef);
                const nuevoValor = (contadorDoc.exists() ? contadorDoc.data().consecutivo : 0) + 1;
                transaction.set(contadorRef, { consecutivo: nuevoValor }, { merge: true });
                return nuevoValor;
            });
            const numeroNota = `${anioActual}-${nuevoConsecutivo.toString().padStart(4, '0')}`;

            const logoUrl = "https://www.grupoevelsa.com/assets/images/Logo Evelsa 2.png";
            const response = await fetch(logoUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
                reader.onload = resolve;
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const logoBase64 = reader.result;
            
            pdfDoc.addImage(logoBase64, 'PNG', 15, 15, 50, 15);
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.setFontSize(10);
            pdfDoc.text("ECOLOGÍA Y ASESORÍA AMBIENTAL S. DE R.L. DE C.V.", 105, 35, { align: 'center' });
            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.setFontSize(8);
            pdfDoc.text("HERMANOS ESCOBAR 6150-2 PARQUE INDUSTRIAL OMEGA", 105, 40, { align: 'center' });
            pdfDoc.text("CP.32410 CD. JUÁREZ, CHIHUAHUA. RFC EAA12060765A", 105, 44, { align: 'center' });
            pdfDoc.setFontSize(16);
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.text("NOTA DE ENTREGA", 105, 55, { align: 'center' });
            pdfDoc.text(numeroNota, 180, 65);
            pdfDoc.setFontSize(11);
            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.text(`FECHA: ${new Date().toLocaleDateString('es-MX')}`, 20, 75);
            pdfDoc.text(`PROYECTO: ${project.npu}`, 20, 85);
            pdfDoc.text(`NOMBRE/RAZÓN SOCIAL: ${project.clienteNombre}`, 20, 95);
            pdfDoc.rect(15, 105, 180, 40);
            pdfDoc.text("DESCRIPCIÓN", 20, 111);
            pdfDoc.text("CANTIDAD", 170, 111);

            const maxDescriptionWidth = 145;
            const splitDescription = pdfDoc.splitTextToSize(project.servicioNombre, maxDescriptionWidth);
            pdfDoc.text(splitDescription, 20, 118);

            pdfDoc.text("1", 175, 118);
            pdfDoc.text("Comentarios:", 20, 155);
            const splitComments = pdfDoc.splitTextToSize(comments, 170);
            pdfDoc.text(splitComments, 20, 162);
            pdfDoc.text("RECIBIDO POR:", 20, 250);
            pdfDoc.line(20, 260, 100, 260);
            pdfDoc.text("NOMBRE Y FIRMA", 45, 265);
            pdfDoc.save(`Nota_Entrega_${numeroNota}.pdf`);
            return { numeroNota };
        };

        const handleCompleteTask = async () => {
            if (!evidenceFile) {
                setError("Es obligatorio subir el archivo PDF de evidencia.");
                return;
            }
            setLoading(true);
            setError('');

            try {
                const evidenceRef = ref(storage, `evidencia_tecnicos/${project.id}/${evidenceFile.name}`);
                const evidenceUploadTask = uploadBytesResumable(evidenceRef, evidenceFile);
                const evidenceUrl = await getDownloadURL((await evidenceUploadTask).ref);

                const { numeroNota } = await generateAndSaveNota();
                
                const projectRef = doc(db, "proyectos", project.id);
                const updatePayload = {
                    estado: 'Terminado Internamente',
                    comentariosTecnico: comments
                };

                if (!project.urlDocumento1) {
                    updatePayload.urlEvidenciaTecnico1 = evidenceUrl;
                    updatePayload.numeroNotaInterna1 = numeroNota;
                    updatePayload.fechaFinTecnico1 = Timestamp.now();
                } else {
                    updatePayload.urlEvidenciaTecnico2 = evidenceUrl;
                    updatePayload.numeroNotaInterna2 = numeroNota;
                    updatePayload.fechaFinTecnico2 = Timestamp.now();
                }

                await updateDoc(projectRef, updatePayload);
                
                onFinalized();
                onClose();

            } catch (err) {
                console.error("Error al completar la tarea:", err);
                setError(err.message || "Ocurrió un error al guardar los datos.");
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Gestionar Tarea: {project.npu}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Comentarios Finales (para Nota de Entrega)</label>
                            <textarea value={comments} onChange={e => setComments(e.target.value)} rows="4" className="mt-1 block w-full px-3 py-2 border rounded-md"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Subir Evidencia Técnica (PDF)</label>
                            <input type="file" accept=".pdf" onChange={handleFileChange} className="mt-1 block w-full text-sm"/>
                        </div>
                    </div>
                    <Alert message={error} type="error" onClose={() => setError('')} />
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} disabled={loading} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button onClick={handleCompleteTask} disabled={loading} className="bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded">{loading ? 'Enviando...' : 'Generar Nota y Finalizar Tarea'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const formatDate = (timestamp) => !timestamp ? '---' : new Date(timestamp.seconds * 1000).toLocaleDateString('es-MX');

    return (
        <>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Límite</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {projects.map(project => (
                             <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(project.fechaEntregaInterna)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-4">
                                        {project.tecnicosStatus[user.uid] === 'No Visto' && <button onClick={() => handleStartProject(project)} className="text-green-600 hover:text-green-900">Empezar</button>}
                                        {project.tecnicosStatus[user.uid] === 'En Proceso' && (
                                            <>
                                                <button onClick={() => { setModalProject(project); setModalType('task'); }} className="text-indigo-600">Gestionar Tarea</button>
                                                <button onClick={() => { setModalProject(project); setModalType('log'); }} className="text-gray-600">Bitácora</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modalProject && modalType === 'task' && <ManageTaskModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={onUpdateProject} />}
            {modalProject && modalType === 'log' && <ProjectLogModal project={modalProject} user={user} userData={userData} onClose={() => setModalProject(null)} selectedRole={selectedRole} />}
        </>
    );
};

// El dashboard de Finanzas. Gestiona las facturas, cuentas por cobrar y por pagar.
const FinanzasDashboard = ({ user, userData }) => {
    const [view, setView] = useState('pendientes');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPendingProjects = () => {
        setLoading(true);
        const q = query(collection(db, "proyectos"), where("estado", "in", ["Pendiente de Factura", "Facturado"]));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            projectsData.forEach(project => {
                if (project.estado === 'Facturado' && project.faseFacturacion === 'Preliminar') {
                    console.log(`[AUTO-REACTIVACIÓN] Proyecto ${project.npu} detectado para Fase 2.`);
                    const projectRef = doc(db, "proyectos", project.id);
                    const newTecnicosStatus = {};
                    if (project.asignadoTecnicosIds) {
                        project.asignadoTecnicosIds.forEach(techId => {
                            newTecnicosStatus[techId] = 'En Proceso';
                        });
                    }
                    updateDoc(projectRef, {
                        estado: 'Activo',
                        tecnicosStatus: newTecnicosStatus,
                        faseFacturacion: 'Fase 2 Pendiente'
                    });
                }
            });

            setProjects(projectsData.filter(p => p.estado === 'Pendiente de Factura'));
            setLoading(false);
        });
        
        return unsubscribe;
    };

    useEffect(() => {
        let unsubscribe = () => {};
        if (view === 'pendientes') {
            unsubscribe = fetchPendingProjects();
        } else {
            setLoading(false);
        }
        return () => unsubscribe();
    }, [view]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Panel de Finanzas</h1>
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setView('pendientes')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'pendientes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Pendientes de Gestión
                    </button>
                    <button onClick={() => setView('cobrar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'cobrar' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Cuentas por Cobrar
                    </button>
                    <button onClick={() => setView('pagar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'pagar' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Cuentas por Pagar
                    </button>
                </nav>
            </div>

            {view === 'pendientes' && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 my-6">Proyectos Pendientes de Facturar</h2>
                    {loading ? <p>Cargando proyectos...</p> : 
                        <PendingInvoicesTable projects={projects} onUpdate={fetchPendingProjects} />
                    }
                </div>
            )}
            {view === 'cobrar' && <InvoicesList invoiceType="cliente" onUpdate={() => {}} />}
            {view === 'pagar' && <InvoicesList invoiceType="proveedor" onUpdate={() => {}} />}
        </div>
    );
};

const PendingInvoicesTable = ({ projects, onUpdate }) => {
    const [modalProject, setModalProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const AttachInvoicesModal = ({ project, onClose, onFinalized }) => {
        const [mode, setMode] = useState('upload');
        const [clientInvoice, setClientInvoice] = useState({ folio: '', monto: project.precioCotizacionCliente || '', fechaEmision: new Date().toISOString().split('T')[0] });
        const [clientFiles, setClientFiles] = useState({ xmlFile: null, pdfFile: null });
        const [providerInvoice, setProviderInvoice] = useState({ folio: '', monto: project.costoProveedor || '', fechaEmision: new Date().toISOString().split('T')[0] });
        const [providerFiles, setProviderFiles] = useState({ xmlFile: null, pdfFile: null });
        const [linkableInvoices, setLinkableInvoices] = useState([]);
        const [selectedClientInvoiceId, setSelectedClientInvoiceId] = useState('');
        const [selectedProviderInvoiceId, setSelectedProviderInvoiceId] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        
        const isInternalProvider = project.proveedorNombre?.toLowerCase().includes("ecologia");

        useEffect(() => {
            if (mode === 'link') {
                const q = query(collection(db, "facturas"), orderBy("fechaEmision", "desc"));
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    setLinkableInvoices(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
                });
                return () => unsubscribe();
            }
        }, [mode]);

        const handleChange = (setter) => (e) => {
            const { name, value } = e.target;
            setter(prev => ({ ...prev, [name]: value }));
        };

        const handleFileChange = (setter) => (e) => {
            const { name, files: inputFiles } = e.target;
            if (inputFiles[0]) setter(prev => ({ ...prev, [name]: inputFiles[0] }));
        };
        
        const uploadFile = async (file, path) => {
            if (!file) return null;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            return getDownloadURL((await uploadTask).ref);
        };

        const handleSave = async () => {
            setLoading(true);
            setError('');
            try {
                const projectRef = doc(db, "proyectos", project.id);
                const updatePayload = {};
                let finalFacturaClienteIds = project.facturasClienteIds || [];
                let finalFacturaProveedorIds = project.facturasProveedorIds || [];

                if (mode === 'upload') {
                    if (clientFiles.xmlFile && clientFiles.pdfFile && clientInvoice.folio) {
                        const urlXml = await uploadFile(clientFiles.xmlFile, `facturas_clientes/${project.id}/${clientFiles.xmlFile.name}`);
                        const urlPdf = await uploadFile(clientFiles.pdfFile, `facturas_clientes/${project.id}/${clientFiles.pdfFile.name}`);
                        const newInvoiceRef = await addDoc(collection(db, "facturas"), {
                            tipo: "cliente", proyectoId: project.id, folio: clientInvoice.folio, monto: Number(clientInvoice.monto),
                            fechaEmision: Timestamp.fromDate(new Date(clientInvoice.fechaEmision)), estado: "Pendiente", urlXml, urlPdf,
                            clienteNombre: project.clienteNombre
                        });
                        finalFacturaClienteIds.push(newInvoiceRef.id);
                        updatePayload.facturasClienteIds = finalFacturaClienteIds;
                    }
                    if (!isInternalProvider && providerFiles.xmlFile && providerFiles.pdfFile && providerInvoice.folio) {
                        const urlXml = await uploadFile(providerFiles.xmlFile, `facturas_proveedores/${project.id}/${providerFiles.xmlFile.name}`);
                        const urlPdf = await uploadFile(providerFiles.pdfFile, `facturas_proveedores/${project.id}/${providerFiles.pdfFile.name}`);
                        const newInvoiceRef = await addDoc(collection(db, "facturas"), {
                            tipo: "proveedor", proyectoId: project.id, folio: providerInvoice.folio, monto: Number(providerInvoice.monto),
                            fechaEmision: Timestamp.fromDate(new Date(providerInvoice.fechaEmision)), estado: "Pendiente", urlXml, urlPdf,
                            proveedorNombre: project.proveedorNombre
                        });
                        finalFacturaProveedorIds.push(newInvoiceRef.id);
                        updatePayload.facturasProveedorIds = finalFacturaProveedorIds;
                    }
                } else { 
                    if (selectedClientInvoiceId) {
                        await updateDoc(doc(db, "facturas", selectedClientInvoiceId), { proyectosIds: arrayUnion(project.id) });
                        finalFacturaClienteIds.push(selectedClientInvoiceId);
                        updatePayload.facturasClienteIds = arrayUnion(selectedClientInvoiceId);
                    }
                    if (selectedProviderInvoiceId && !isInternalProvider) {
                        await updateDoc(doc(db, "facturas", selectedProviderInvoiceId), { proyectosIds: arrayUnion(project.id) });
                        finalFacturaProveedorIds.push(selectedProviderInvoiceId);
                        updatePayload.facturasProveedorIds = arrayUnion(selectedProviderInvoiceId);
                    }
                }
                
                const isClientInvoiceReady = finalFacturaClienteIds.length > 0;
                const isProviderInvoiceReady = isInternalProvider || finalFacturaProveedorIds.length > 0;

                if (isClientInvoiceReady && isProviderInvoiceReady) {
                    updatePayload.estado = 'Facturado';
                }
                
                if (Object.keys(updatePayload).length > 0) {
                    await updateDoc(projectRef, updatePayload);
                }
                
                onFinalized();
                onClose();

            } catch (err) {
                console.error("Error al guardar la factura:", err);
                setError("Ocurrió un error al guardar la factura.");
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                    <h3 className="text-lg font-bold mb-4">Gestionar Facturas: {project.npu}</h3>
                    
                    <div className="mb-4 border-b">
                        <nav className="-mb-px flex space-x-8">
                            <button onClick={() => setMode('upload')} className={`py-2 px-1 border-b-2 font-medium text-sm ${mode === 'upload' ? 'border-blue-500' : 'border-transparent'}`}>Subir Nueva Factura</button>
                            <button onClick={() => setMode('link')} className={`py-2 px-1 border-b-2 font-medium text-sm ${mode === 'link' ? 'border-blue-500' : 'border-transparent'}`}>Enlazar Factura Existente</button>
                        </nav>
                    </div>

                    {mode === 'upload' && (
                        <div className={`grid grid-cols-1 ${!isInternalProvider ? 'md:grid-cols-2' : ''} gap-6`}>
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-semibold text-gray-800">Factura a Cliente</h4>
                                {project.facturaClienteId ? <p className="text-green-600">✓ Factura ya adjuntada.</p> : <>
                                    <input type="text" name="folio" placeholder="Folio Factura" value={clientInvoice.folio} onChange={handleChange(setClientInvoice)} className="block w-full border rounded-md p-2"/>
                                    <input type="number" name="monto" placeholder="Monto" value={clientInvoice.monto} onChange={handleChange(setClientInvoice)} className="block w-full border rounded-md p-2"/>
                                    <input type="date" name="fechaEmision" value={clientInvoice.fechaEmision} onChange={handleChange(setClientInvoice)} className="block w-full border rounded-md p-2"/>
                                    <label className="text-xs">XML:</label><input type="file" name="xmlFile" accept=".xml" onChange={handleFileChange(setClientFiles)} className="block w-full text-sm"/>
                                    <label className="text-xs">PDF:</label><input type="file" name="pdfFile" accept=".pdf" onChange={handleFileChange(setClientFiles)} className="block w-full text-sm"/>
                                </>}
                            </div>
                            {!isInternalProvider && (
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h4 className="font-semibold text-gray-800">Factura de Proveedor</h4>
                                    {project.facturaProveedorId ? <p className="text-green-600">✓ Factura ya adjuntada.</p> : <>
                                        <input type="text" name="folio" placeholder="Folio Factura" value={providerInvoice.folio} onChange={handleChange(setProviderInvoice)} className="block w-full border rounded-md p-2"/>
                                        <input type="number" name="monto" placeholder="Monto" value={providerInvoice.monto} onChange={handleChange(setProviderInvoice)} className="block w-full border rounded-md p-2"/>
                                        <input type="date" name="fechaEmision" value={providerInvoice.fechaEmision} onChange={handleChange(setProviderInvoice)} className="block w-full border rounded-md p-2"/>
                                        <label className="text-xs">XML:</label><input type="file" name="xmlFile" accept=".xml" onChange={handleFileChange(setProviderFiles)} className="block w-full text-sm"/>
                                        <label className="text-xs">PDF:</label><input type="file" name="pdfFile" accept=".pdf" onChange={handleFileChange(setProviderFiles)} className="block w-full text-sm"/>
                                    </>}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'link' && (
                        <div className={`grid grid-cols-1 ${!isInternalProvider ? 'md:grid-cols-2' : ''} gap-6`}>
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-semibold text-gray-800">Enlazar Factura de Cliente</h4>
                                <select value={selectedClientInvoiceId} onChange={(e) => setSelectedClientInvoiceId(e.target.value)} className="block w-full border rounded-md p-2">
                                    <option value="">Seleccione una factura...</option>
                                    {linkableInvoices.filter(inv => inv.tipo === 'cliente').map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {`Folio: ${inv.folio} - ${inv.clienteNombre} - $${inv.monto.toFixed(2)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {!isInternalProvider && (
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h4 className="font-semibold text-gray-800">Enlazar Factura de Proveedor</h4>
                                    <select value={selectedProviderInvoiceId} onChange={(e) => setSelectedProviderInvoiceId(e.target.value)} className="block w-full border rounded-md p-2">
                                        <option value="">Seleccione una factura...</option>
                                        {linkableInvoices.filter(inv => inv.tipo === 'proveedor').map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {`Folio: ${inv.folio} - ${inv.proveedorNombre} - $${inv.monto.toFixed(2)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <Alert message={error} type="error" onClose={() => setError('')} />
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button onClick={handleSave} className="bg-[#b0ef26] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const filteredProjects = projects.filter(p => (p.npu && p.npu.toLowerCase().includes(searchTerm.toLowerCase())) || (p.clienteNombre && p.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())) || (p.servicioNombre && p.servicioNombre.toLowerCase().includes(searchTerm.toLowerCase())));
    const currentItems = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <>
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
                <input type="text" placeholder="Buscar por NPU, cliente o servicio..." className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md mb-2 md:mb-0" onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}/>
                <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docs Admin</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura Proveedor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(project => (
                             <tr key={project.id}>
                                <td className="px-6 py-4">{project.npu}</td>
                                <td className="px-6 py-4">{project.clienteNombre}</td>
                                <td className="px-6 py-4">{project.servicioNombre}</td>
                                <td className="px-6 py-4"><div className="flex space-x-2 text-sm">{project.urlCotizacionCliente && <a href={project.urlCotizacionCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500">Cot.C</a>}{project.urlPOCliente && <a href={project.urlPOCliente} target="_blank" rel="noopener noreferrer" className="text-blue-500">PO.C</a>}</div></td>
                                <td className="px-6 py-4">{project.facturaClienteId ? <span className="text-green-600">✓ Adjuntada</span> : <span className="text-orange-500">Pendiente</span>}</td>
                                <td className="px-6 py-4">{project.proveedorNombre?.toLowerCase().includes("ecologia") ? <span className="text-gray-500">N/A</span> : project.facturaProveedorId ? <span className="text-green-600">✓ Adjuntada</span> : <span className="text-orange-500">Pendiente</span>}</td>
                                <td className="px-6 py-4"><button onClick={() => setModalProject(project)} className="text-indigo-600 hover:text-indigo-900">Gestionar Facturas</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <div>
                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white mr-2 disabled:opacity-50">Anterior</button>
                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Siguiente</button>
                </div>
            </div>
            {modalProject && <AttachInvoicesModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={onUpdate} />}
        </>
    );
};

const InvoicesList = ({ invoiceType, onUpdate }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalInvoice, setModalInvoice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "facturas"), where("tipo", "==", invoiceType), orderBy("fechaEmision", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [invoiceType]);

    const filteredInvoices = invoices.filter(invoice => 
        (invoice.folio && invoice.folio.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.clienteNombre && invoice.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.proveedorNombre && invoice.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (invoice.descripcion && invoice.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredInvoices.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const AddGeneralInvoiceModal = ({ onClose, onFinalized }) => {
        const [formData, setFormData] = useState({ folio: '', monto: '', fechaEmision: new Date().toISOString().split('T')[0], entidadId: '', descripcion: '' });
        const [files, setFiles] = useState({ xmlFile: null, pdfFile: null });
        const [entities, setEntities] = useState([]);
        const [otherEntityName, setOtherEntityName] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');

        useEffect(() => {
            let q;
            if (invoiceType === 'cliente') {
                q = query(collection(db, "usuarios"), where("rol", "==", "cliente"));
            } else {
                q = query(collection(db, "proveedores"));
            }
            getDocs(q).then(snapshot => {
                const entityList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const sortedEntities = entityList.sort((a, b) => (a.nombreCompleto || a.nombre).localeCompare(b.nombreCompleto || b.nombre));
                setEntities(sortedEntities);
            });
        }, []);
        
        const handleChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleFileChange = (e) => {
            const { name, files: inputFiles } = e.target;
            if (inputFiles[0]) {
                setFiles(prev => ({ ...prev, [name]: inputFiles[0] }));
            }
        };

        const uploadFile = async (file, path) => {
            if (!file) return null;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            return getDownloadURL((await uploadTask).ref);
        };

        const handleSave = async () => {
            if (!formData.folio || !formData.monto || !files.xmlFile || !files.pdfFile || (formData.entidadId === '' || (formData.entidadId === 'otro' && !otherEntityName))) {
                setError("Todos los campos y archivos son obligatorios.");
                return;
            }
            setLoading(true);
            try {
                const urlXml = await uploadFile(files.xmlFile, `facturas_${invoiceType}/${Date.now()}/${files.xmlFile.name}`);
                const urlPdf = await uploadFile(files.pdfFile, `facturas_${invoiceType}/${Date.now()}/${files.pdfFile.name}`);
                
                const entityName = formData.entidadId === 'otro' 
                    ? otherEntityName 
                    : entities.find(e => e.id === formData.entidadId)?.nombreCompleto || entities.find(e => e.id === formData.entidadId)?.nombre;

                await addDoc(collection(db, "facturas"), {
                    tipo: invoiceType,
                    proyectoId: "general",
                    folio: formData.folio,
                    monto: Number(formData.monto),
                    fechaEmision: Timestamp.fromDate(new Date(formData.fechaEmision)),
                    estado: "Pendiente",
                    descripcion: formData.descripcion || '',
                    urlXml,
                    urlPdf,
                    [invoiceType === 'cliente' ? 'clienteNombre' : 'proveedorNombre']: entityName
                });
                onFinalized();
                onClose();
            } catch (err) {
                console.error("Error al guardar factura general:", err);
                setError("Ocurrió un error al guardar.");
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Añadir Factura General ({invoiceType})</h3>
                    <div className="space-y-4">
                        <select value={formData.entidadId} onChange={handleChange} name="entidadId" className="block w-full border rounded-md p-2">
                            <option value="">Seleccione un {invoiceType}</option>
                            {entities.map(e => <option key={e.id} value={e.id}>{e.nombreCompleto || e.nombre}</option>)}
                            <option value="otro">Otro (especificar)</option>
                        </select>
                        {formData.entidadId === 'otro' && (
                            <input type="text" value={otherEntityName} onChange={(e) => setOtherEntityName(e.target.value)} placeholder={`Nombre del ${invoiceType}`} className="block w-full border rounded-md p-2"/>
                        )}
                        <input type="text" name="descripcion" placeholder="Descripción (ej: Renta de oficina)" value={formData.descripcion} onChange={handleChange} className="block w-full border rounded-md p-2"/>
                        <input type="text" name="folio" placeholder="Folio" value={formData.folio} onChange={handleChange} className="block w-full border rounded-md p-2"/>
                        <input type="number" name="monto" placeholder="Monto" value={formData.monto} onChange={handleChange} className="block w-full border rounded-md p-2"/>
                        <input type="date" name="fechaEmision" value={formData.fechaEmision} onChange={handleChange} className="block w-full border rounded-md p-2"/>
                        <label className="text-xs">XML:</label><input type="file" name="xmlFile" accept=".xml" onChange={handleFileChange} className="block w-full text-sm"/>
                        <label className="text-xs">PDF:</label><input type="file" name="pdfFile" accept=".pdf" onChange={handleFileChange} className="block w-full text-sm"/>
                    </div>
                     <Alert message={error} type="error" onClose={() => setError('')} />
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose}>Cancelar</button>
                        <button onClick={handleSave} className="bg-[#b0ef26] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const ManageInvoiceModal = ({ invoice, onClose, onFinalized }) => {
        const [formData, setFormData] = useState({
            fechaPromesaPago: invoice.fechaPromesaPago ? invoice.fechaPromesaPago.toDate().toISOString().split('T')[0] : '',
            fechaPagoReal: invoice.fechaPagoReal ? invoice.fechaPagoReal.toDate().toISOString().split('T')[0] : ''
        });
        const [loading, setLoading] = useState(false);

        const handleSave = async () => {
            setLoading(true);
            const updatePayload = {
                fechaPromesaPago: formData.fechaPromesaPago ? Timestamp.fromDate(new Date(formData.fechaPromesaPago)) : null,
                fechaPagoReal: formData.fechaPagoReal ? Timestamp.fromDate(new Date(formData.fechaPagoReal)) : null,
            };
            if (formData.fechaPagoReal) {
                updatePayload.estado = "Pagada";
            } else if (invoice.estado === "Pagada") {
                updatePayload.estado = "Pendiente";
            }
            await updateDoc(doc(db, "facturas", invoice.id), updatePayload);
            onFinalized();
            onClose();
        };
        
        const handleCancelInvoice = async () => {
            if (window.confirm("¿Estás seguro de que quieres cancelar esta factura? Esta acción es irreversible.")) {
                setLoading(true);
                await updateDoc(doc(db, "facturas", invoice.id), { estado: "Cancelada" });
                if (invoice.proyectoId && invoice.proyectoId !== 'general') {
                    const fieldToUpdate = invoice.tipo === 'cliente' ? 'facturaClienteId' : 'facturaProveedorId';
                    await updateDoc(doc(db, "proyectos", invoice.proyectoId), { 
                        [fieldToUpdate]: deleteField(),
                        estado: 'Pendiente de Factura'
                    });
                }
                onFinalized();
                onClose();
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Gestionar Factura: {invoice.folio}</h3>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium">Fecha Promesa de Pago</label><input type="date" value={formData.fechaPromesaPago} onChange={e => setFormData({...formData, fechaPromesaPago: e.target.value})} className="mt-1 block w-full border rounded-md p-2"/></div>
                        <div><label className="block text-sm font-medium">Fecha de Pago Real</label><input type="date" value={formData.fechaPagoReal} onChange={e => setFormData({...formData, fechaPagoReal: e.target.value})} className="mt-1 block w-full border rounded-md p-2"/></div>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                        <button onClick={handleCancelInvoice} disabled={loading} className="bg-red-600 text-white font-bold py-2 px-4 rounded disabled:bg-red-300">Cancelar Factura</button>
                        <div>
                            <button onClick={onClose} disabled={loading} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded mr-2">Cerrar</button>
                            <button onClick={handleSave} disabled={loading} className="bg-[#b0ef26] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const formatDate = (timestamp) => !timestamp ? '---' : new Date(timestamp.seconds * 1000).toLocaleDateString('es-MX');
    
    const getStatusClass = (invoice) => {
        if (invoice.estado === 'Pagada') return 'bg-green-100 text-green-800';
        if (invoice.estado === 'Cancelada') return 'bg-gray-100 text-gray-500 line-through';
        if (invoice.fechaVencimiento && invoice.fechaVencimiento.toDate() < new Date()) return 'bg-red-100 text-red-800';
        return 'bg-orange-100 text-orange-800';
    };

    return (
        <div>
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center">
                <input 
                    type="text"
                    placeholder="Buscar por folio, cliente/prov. o descripción..."
                    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md mb-2 md:mb-0"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                    <button onClick={() => setShowAddModal(true)} className="ml-4 bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-2 px-4 rounded-lg">
                        + Añadir Factura General
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Folio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">{invoiceType === 'cliente' ? 'Cliente' : 'Proveedor'}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Descripción</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Monto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Emisión</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Promesa Pago</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Pago</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan="9">Cargando...</td></tr> : currentItems.map(invoice => (
                            <tr key={invoice.id}>
                                <td className="px-6 py-4">{invoice.folio}</td>
                                <td className="px-6 py-4">{invoice.clienteNombre || invoice.proveedorNombre}</td>
                                <td className="px-6 py-4">{invoice.descripcion || (invoice.proyectoId !== 'general' ? 'Gasto de Proyecto' : '---')}</td>
                                <td className="px-6 py-4">${(invoice.monto || 0).toFixed(2)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaEmision)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaPromesaPago)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaPagoReal)}</td>
                                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(invoice)}`}>{invoice.estado}</span></td>
                                <td className="px-6 py-4"><button onClick={() => setModalInvoice(invoice)} className="text-indigo-600">Gestionar</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
                <div>
                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-md bg-white mr-2 disabled:opacity-50">Anterior</button>
                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Siguiente</button>
                </div>
            </div>
            {showAddModal && <AddGeneralInvoiceModal onClose={() => setShowAddModal(false)} onFinalized={onUpdate} />}
            {modalInvoice && <ManageInvoiceModal invoice={modalInvoice} onClose={() => setModalInvoice(null)} onFinalized={onUpdate} />}
        </div>
    );
};

// El dashboard del Practicante. Recibe los proyectos terminados por los técnicos
// para preparar los entregables finales para el cliente.

const PracticanteDashboard = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalProject, setModalProject] = useState(null);
    const [submittingId, setSubmittingId] = useState(null);
    const [confirmingAction, setConfirmingAction] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc');

    const fetchProjects = () => {
        setLoading(true);
        const q = query(collection(db, "proyectos"), where("estado", "in", ["Terminado Internamente", "En Revisión Final"]));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(projectsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projects for practicante: ", error);
            setLoading(false);
        });
        
        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchProjects();
        return () => unsubscribe();
    }, []);

    const sortedProjects = React.useMemo(() => {
        const sortable = [...projects];
        sortable.sort((a, b) => {
            const dateA = a.fechaFinTecnico2 || a.fechaFinTecnico1;
            const dateB = b.fechaFinTecnico2 || b.fechaFinTecnico1;
            const fieldA = dateA?.toDate() || new Date(0);
            const fieldB = dateB?.toDate() || new Date(0);

            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sortable;
    }, [projects, sortOrder]);

    const ManageFinalDeliveryModal = ({ project, onClose, onFinalized }) => {
        const [heyzineUrl, setHeyzineUrl] = useState(project.urlHeyzine || '');
        const [notaPdfFile1, setNotaPdfFile1] = useState(null);
        const [notaPdfFile2, setNotaPdfFile2] = useState(null);
        const [loading, setLoading] = useState(false);

        const handleFileChange = (setter) => (e) => { if (e.target.files[0]) setter(e.target.files[0]) };

        const uploadFile = async (file, path) => {
            if (!file) return null;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            return getDownloadURL((await uploadTask).ref);
        };

        const handleSave = async () => {
            setLoading(true);
            const updatePayload = {
                urlHeyzine: heyzineUrl 
            };
            const nota1Url = await uploadFile(notaPdfFile1, `notas_entrega_cliente/${project.id}/nota1_${notaPdfFile1?.name}`);
            const nota2Url = await uploadFile(notaPdfFile2, `notas_entrega_cliente/${project.id}/nota2_${notaPdfFile2?.name}`);

            if (nota1Url) updatePayload.urlNotaPdf1 = nota1Url;
            if (nota2Url) updatePayload.urlNotaPdf2 = nota2Url;

            if (Object.keys(updatePayload).length > 0) {
                await updateDoc(doc(db, "proyectos", project.id), updatePayload);
            }
            onFinalized();
            onClose();
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Gestionar Entrega Final: {project.npu}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Enlace Heyzine (Único)</label>
                            <input type="text" value={heyzineUrl} onChange={(e) => setHeyzineUrl(e.target.value)} className="mt-1 block w-full border rounded-md p-2"/>
                        </div>
                        <hr/>
                        <div>
                            <label className="block text-sm font-medium">Subir/Reemplazar Nota de Entrega 1 (Firmada)</label>
                            <input type="file" accept=".pdf" onChange={handleFileChange(setNotaPdfFile1)} className="mt-1 block w-full text-sm"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Subir/Reemplazar Nota de Entrega 2 (Firmada)</label>
                            <input type="file" accept=".pdf" onChange={handleFileChange(setNotaPdfFile2)} className="mt-1 block w-full text-sm"/>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Documentos'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const handleSendToReview = async (projectId) => {
        setSubmittingId(projectId);
        try {
            await updateDoc(doc(db, "proyectos", projectId), {
                estado: 'En Revisión Final',
                motivoRechazo: deleteField()
            });
        } catch (error) {
            console.error("Error sending project to review:", error);
            alert("Ocurrió un error al enviar el proyecto a revisión.");
        } finally {
            setSubmittingId(null);
        }
    };

    const promptSendToReview = (projectId) => {
        setConfirmingAction({
            title: "Confirmar Envío",
            message: "¿Estás seguro de que todos los documentos están listos y quieres enviar este proyecto a revisión final?",
            onConfirm: () => handleSendToReview(projectId)
        });
        setConfirmingAction(null);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Proyectos Listos para Documentar</h1>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Ordenar por Fecha de Entrega:</span>
                    <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-md text-sm bg-white shadow-sm">
                        {sortOrder === 'asc' ? 'Más Antiguos Primero ↑' : 'Más Recientes Primero ↓'}
                    </button>
                </div>
            </div>

            {loading ? <p>Cargando...</p> : sortedProjects.length === 0 ? <p>No hay proyectos pendientes.</p> : (
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos del Técnico</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projects.map(project => (
                                 <tr key={project.id} className={project.motivoRechazo ? "bg-orange-50" : ""}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.npu}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col space-y-1 text-sm">
                                            {project.urlEvidenciaTecnico1 && (
                                                <div className="p-2 border-b">
                                                    <p className="font-semibold text-xs">Fase 1:</p>
                                                    <a href={project.urlEvidenciaTecnico1} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Evidencia 1</a>
                                                    <p>Nota Interna 1: <span className="font-semibold">{project.numeroNotaInterna1 || 'N/A'}</span></p>
                                                </div>
                                            )}
                                            {project.urlEvidenciaTecnico2 && (
                                                <div className="p-2">
                                                    <p className="font-semibold text-xs">Fase 2:</p>
                                                    <a href={project.urlEvidenciaTecnico2} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Evidencia 2</a>
                                                    <p>Nota Interna 2: <span className="font-semibold">{project.numeroNotaInterna2 || 'N/A'}</span></p>
                                                </div>
                                            )}
                                            {project.urlEvidenciaTecnico && !project.urlEvidenciaTecnico1 && (
                                                 <a href={project.urlEvidenciaTecnico} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Evidencia</a>
                                            )}
                                            
                                            {project.motivoRechazo && (
                                                <div className="mt-2 p-2 bg-orange-100 text-orange-800 rounded-md">
                                                    <p className="font-bold text-xs">Correcciones Pendientes:</p>
                                                    <p className="text-xs">{project.motivoRechazo}</p>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => setModalProject(project)} className="text-indigo-600 hover:text-indigo-900 mr-4">Gestionar Entrega</button>
                                        {project.estado === 'Terminado Internamente' && (
                                            <button 
                                                onClick={() => promptSendToReview(project.id)} 
                                                disabled={submittingId === project.id}
                                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                            >
                                                {submittingId === project.id ? 'Enviando...' : 'Enviar a Revisión'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {modalProject && <ManageFinalDeliveryModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={fetchProjects} />}
            {confirmingAction && (
                <ConfirmationModal 
                    title={confirmingAction.title}
                    message={confirmingAction.message}
                    onConfirm={confirmingAction.onConfirm}
                    onCancel={() => setConfirmingAction(null)}
                />
            )}
        </div>
    );
};

// Este es el "router" principal. Recibe el rol activo del usuario
// y decide qué dashboard específico debe mostrar.
const Dashboard = ({ user, userData, selectedRole }) => {
    
    const renderDashboardByRole = () => {
        switch (selectedRole) {
            case 'administrador':
                return <AdminDashboard user={user} userData={userData} />;
            case 'cliente':
                return <ClientDashboard user={user} userData={userData} />;
            case 'directivo':
                return <DirectivoDashboard user={user} userData={userData} />;
            case 'ecotech':
                return <EcotechDashboard user={user} userData={userData} />;
            case 'supervisor':
                return <SupervisorDashboard user={user} userData={userData} />;
            case 'tecnico':
                return <TecnicoDashboard user={user} userData={userData} selectedRole={selectedRole} />;
            case 'finanzas':
                return <FinanzasDashboard user={user} userData={userData} />;
            case 'practicante':
                return <PracticanteDashboard />;
            default:
                return <div><h2 className="text-2xl font-bold">Rol no reconocido</h2><p>Contacte al administrador.</p></div>;
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {renderDashboardByRole()}
        </div>
    );
};

const AuthPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try { 
            await signInWithEmailAndPassword(auth, email, password); 
        } catch (err) { 
            setError("Email o contraseña incorrectos."); 
        }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#cdcdcd]">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-2xl">
                <img src="https://www.grupoevelsa.com/assets/images/Logo Evelsa 2.png" alt="Logo Grupo Evelsa" className="h-16 mx-auto mb-6"/>
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Acceso al Portal</h2>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" className="w-full bg-[#b0ef26] hover:bg-[#9ac91e] text-black font-bold py-3 px-4 rounded-lg transition duration-300 text-lg">
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

// El componente principal que envuelve toda la aplicación.
export default function App() {
    // Aquí manejo el estado principal: quién es el usuario, sus datos y qué rol está usando.
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState(null);

    // Este efecto se ejecuta una vez para verificar si hay una sesión activa.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Si hay un usuario, busco sus datos en Firestore.
                const userDocRef = doc(db, "usuarios", currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUserData(data);
                    setUser(currentUser);
                    // Lógica para manejar el rol activo, ya sea uno solo o el primero de una lista.
                    if (data.roles && data.roles.length > 0) {
                        setSelectedRole(data.roles[0]);
                    } else if (data.rol) {
                        setSelectedRole(data.rol);
                    }

                } else {
                    console.error("Usuario autenticado pero no encontrado en Firestore. Deslogueando...");
                    signOut(auth);
                }
            } else {
                // Si no hay sesión, limpio todos los datos.
                setUser(null);
                setUserData(null);
                setSelectedRole(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Muestro "Cargando..." mientras verifico la sesión.
    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#cdcdcd] text-gray-700">Cargando...</div>;
    }

    // El contenedor principal de mi app.
    return (
        <div className="bg-[#c9c9c9] min-h-screen font-sans">
             <Header user={user} userData={userData} selectedRole={selectedRole} setSelectedRole={setSelectedRole}/>
             <main>
                 {/* Si hay un usuario, muestro el Dashboard; si no, la página de Login. */}
                 {user && userData ? <Dashboard user={user} userData={userData} selectedRole={selectedRole} /> : <AuthPage />}
             </main>
        </div>
    );
}
