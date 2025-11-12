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
    arrayUnion,
    writeBatch
} from 'firebase/firestore';

import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from 'firebase/storage';

import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, LineController, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { XMLParser } from 'fast-xml-parser';
import { getDatabase, ref as rtdbRef, onValue, set, onDisconnect, serverTimestamp } from "firebase/database";

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
const PROYECTOS_COLLECTION = 'proyectos_v2';
const storage = getStorage(app);
const rtdb = getDatabase(app);

const formatDate = (timestamp) => {
    if (!timestamp) return '---';

    let date;
    if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else {
        try {
            date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Fecha Inválida';
        } catch (e) {
            return 'Fecha Inválida';
        }
    }

    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return adjustedDate.toLocaleDateString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
};

//countdown
const useCountdown = (endTime) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!endTime) {
            setTimeLeft(0);
            return;
        }

        const endTimestamp = endTime.toDate().getTime();
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = endTimestamp - now;
            setTimeLeft(remaining > 0 ? remaining : 0);
        }, 1000);

        return () => clearInterval(interval);
    }, [endTime]);

    const formatTime = (ms) => {
        if (ms <= 0) return "00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return formatTime(timeLeft);
};

// componente para el banner de descanso para ir a comer
const BreakBanner = ({ breakInfo, onEndBreak }) => {
    const breakEndTime = new Timestamp(breakInfo.inicio.seconds + (75 * 60), breakInfo.inicio.nanoseconds);
    const timeLeft = useCountdown(breakEndTime);

    return (
        <div className="bg-yellow-500 text-white p-4 rounded-lg shadow-lg mb-8 flex justify-between items-center sticky top-20 z-30">
            <div>
                <p className="font-bold">En Descanso</p>
                <p className="text-lg">El trabajo se reanudará automáticamente.</p>
            </div>
            <div className="flex items-center space-x-6">
                <div className="text-right">
                    <p className="text-2xl font-mono">{timeLeft}</p>
                    <p className="text-xs">Tiempo Restante</p>
                </div>
                <button onClick={onEndBreak} className="bg-green-600 hover:bg-green-700 font-bold py-3 px-4 rounded-lg">
                    Volver al Trabajo
                </button>
            </div>
        </div>
    );
};

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

//logica para cronometrar a los tecnicos
const useTimer = (startTime) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        if (!startTime) {
            setElapsedTime(0);
            return;
        }

        const startTimestamp = startTime.toDate().getTime();
        const interval = setInterval(() => {
            const now = Date.now();
            setElapsedTime(now - startTimestamp);
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    return formatTime(elapsedTime);
};

//Funcion para los dias laborales
/**
 * @param {Date} startDate 
 * @param {number} days
 * @return {Date}
 */
const addBusinessDays = (startDate, days) => {
    if (!startDate) return null;
    let currentDate = new Date(startDate);
    let addedDays = 0;
    while (addedDays < days) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            addedDays++;
        }
    }
    return currentDate;
};

// Funcion para leer los xml en el apartado de finanzas
/**
 * 
 * @param {string} xmlText
 * @return {object|null}
 */
const parseInvoiceXML = (xmlText) => {
    try {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseAttributeValue: true,
        });
        const jsonData = parser.parse(xmlText);

        const comprobante = jsonData["cfdi:Comprobante"];
        if (!comprobante) throw new Error("Nodo <cfdi:Comprobante> no encontrado.");

        const complemento = comprobante["cfdi:Complemento"]?.["tfd:TimbreFiscalDigital"];
        if (!complemento) throw new Error("Nodo <tfd:TimbreFiscalDigital> no encontrado.");

        let iva = 0;
        const impuestosNode = comprobante["cfdi:Impuestos"];
        if (impuestosNode && impuestosNode["@_TotalImpuestosTrasladados"]) {
            iva = impuestosNode["@_TotalImpuestosTrasladados"];
        } else if (impuestosNode && impuestosNode["cfdi:Traslados"]) {
            const trasladosNode = impuestosNode["cfdi:Traslados"];
            const traslados = Array.isArray(trasladosNode["cfdi:Traslado"])
                ? trasladosNode["cfdi:Traslado"]
                : [trasladosNode["cfdi:Traslado"]];
            
            traslados.forEach(t => {
                if (t && t['@_Impuesto'] === '002') {
                    iva += t['@_Importe'];
                }
            });
        }

        return {
            folio: comprobante['@_Folio'] || 'S/F',
            uuid: complemento['@_UUID'],
            subtotal: comprobante['@_SubTotal'],
            iva: iva,
            monto: comprobante['@_Total'],
            fechaEmision: new Date(comprobante['@_Fecha']),
            rfcEmisor: comprobante["cfdi:Emisor"]?.['@_Rfc'],
            rfcReceptor: comprobante["cfdi:Receptor"]?.['@_Rfc'],
        };
    } catch (err) {
        console.error("Error al parsear el XML:", err);
        return null;
    }
};

// modal para obtener datos de antiguedad de saldos y graficar
const AgingReport = () => {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);

    useEffect(() => {
        const calculateAgingReport = async () => {
            setLoading(true);
            const q = query(
                collection(db, "facturas"),
                where("tipo", "==", "cliente"),
                where("estado", "==", "Pendiente")
            );

            const snapshot = await getDocs(q);
            const pendingInvoices = snapshot.docs.map(doc => doc.data());

            const today = new Date();
            const buckets = {
                "0-30 Días": 0,
                "31-60 Días": 0,
                "61-90 Días": 0,
                "+90 Días": 0,
            };

            pendingInvoices.forEach(inv => {
                const issueDate = inv.fechaEmision.toDate();
                const diffTime = Math.abs(today - issueDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 30) buckets["0-30 Días"] += inv.monto;
                else if (diffDays <= 60) buckets["31-60 Días"] += inv.monto;
                else if (diffDays <= 90) buckets["61-90 Días"] += inv.monto;
                else buckets["+90 Días"] += inv.monto;
            });
            
            setReportData({
                labels: Object.keys(buckets),
                datasets: [{
                    label: 'Monto Pendiente de Cobro',
                    data: Object.values(buckets),
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(255, 159, 64, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(255, 99, 132, 1)',
                    ],
                    borderWidth: 1
                }]
            });
            setLoading(false);
        };

        calculateAgingReport();
    }, []);

    if (loading) return <p>Calculando reporte de antigüedad...</p>;

    const options = {
        indexAxis: 'y', // Para hacer la gráfica de barras horizontal
        responsive: true,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Monto Pendiente de Cobro por Antigüedad'
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            {reportData && <Bar data={reportData} options={options} />}
        </div>
    );
};

// modal de confirmación genérico para acciones simples (ej. "¿Estás seguro?").
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
        const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
        
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

const ProjectManagementModal = ({ project, onClose, onUpdate, user, userData, userRole }) => {
    const [formData, setFormData] = useState({
        prioridad: project.prioridad || "1 - Normal",
        fechaEntregaInterna: project.fechaEntregaInterna ? project.fechaEntregaInterna.toDate().toISOString().split('T')[0] : '',
        notasSupervisor: project.notasSupervisor || '',
        precioCotizacionCliente: project.precioCotizacionCliente || '',
        costoProveedor: project.costoProveedor || '',
        cotizacionClienteRef: project.cotizacionClienteRef || '',
        poClienteRef: project.poClienteRef || '',
        cotizacionProveedorRef: project.cotizacionProveedorRef || '',
    });
    const [loading, setLoading] = useState(false);
    const [logEntries, setLogEntries] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    useEffect(() => {
        setLoadingLogs(true);
        const q = query(
            collection(db, "bitacoras_proyectos"),
            where("projectId", "==", project.id),
            orderBy("fecha", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingLogs(false);
        });
        return () => unsubscribe();
    }, [project.id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
    
        const updatePayload = {};

        if (userRole === 'supervisor') {
            updatePayload.prioridad = formData.prioridad;
            updatePayload.fechaEntregaInterna = formData.fechaEntregaInterna ? Timestamp.fromDate(new Date(formData.fechaEntregaInterna)) : null;
            updatePayload.notasSupervisor = formData.notasSupervisor;
        } else if (userRole === 'administrador') {
            updatePayload.precioCotizacionCliente = Number(formData.precioCotizacionCliente) || 0;
            updatePayload.costoProveedor = Number(formData.costoProveedor) || 0;
            updatePayload.cotizacionClienteRef = formData.cotizacionClienteRef;
            updatePayload.poClienteRef = formData.poClienteRef;
            updatePayload.cotizacionProveedorRef = formData.cotizacionProveedorRef;
        }

        try {
            if (Object.keys(updatePayload).length > 0) {
                await updateDoc(projectRef, updatePayload);
            }
            onUpdate();
            onClose();
            toast.success("Proyecto actualizado correctamente.");
        } catch (err) {
            toast.error("Error al guardar los cambios.");
            console.error("Error al guardar:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-bold mb-4">Gestionar Proyecto: {project.npu}</h3>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    
                    {userRole === 'supervisor' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium">Prioridad</label>
                                    <select name="prioridad" value={formData.prioridad}onChange={handleChange}className="mt-1 block w-full p-2 border rounded-md"
                                    >
                                        <option value="1 - Normal">Normal</option>
                                        <option value="2 - Alta">Alta</option>
                                        <option value="3 - Urgente">Urgente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Fecha Límite de Entrega</label>
                                    <input type="date" name="fechaEntregaInterna" value={formData.fechaEntregaInterna} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Notas del Supervisor</label>
                                    <textarea name="notasSupervisor" value={formData.notasSupervisor} onChange={handleChange} rows="8" className="mt-1 block w-full p-2 border rounded-md"></textarea>
                                </div>
                            </>
                        )}

                    {userRole === 'administrador' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" name="precioCotizacionCliente" value={formData.precioCotizacionCliente} onChange={handleChange} placeholder="Precio Cliente" className="px-3 py-2 border rounded-md"/>
                                <input type="number" name="costoProveedor" value={formData.costoProveedor} onChange={handleChange} placeholder="Costo Proveedor" className="px-3 py-2 border rounded-md"/>
                            </div>
                            <input type="text" name="cotizacionClienteRef" value={formData.cotizacionClienteRef} onChange={handleChange} placeholder="Ref. Cotización Cliente" className="w-full px-3 py-2 border rounded-md"/>
                            <input type="text" name="poClienteRef" value={formData.poClienteRef} onChange={handleChange} placeholder="Ref. PO Cliente" className="w-full px-3 py-2 border rounded-md"/>
                            <input type="text" name="cotizacionProveedorRef" value={formData.cotizacionProveedorRef} onChange={handleChange} placeholder="Ref. Cotización Proveedor" className="w-full px-3 py-2 border rounded-md"/>
                        </>
                    )}
                    {userRole === 'supervisor' && ( 
                        <div>
                            <label className="block text-sm font-medium mb-1">Bitácora (Solo Lectura)</label>
                            <div className="bg-gray-50 border rounded-md p-2 h-96 overflow-y-auto space-y-2">
                                {loadingLogs ? <p>Cargando...</p> : logEntries.length > 0 ? logEntries.map(entry => (
                                    <div key={entry.id} className="text-xs border-b pb-1">
                                        <p className="text-gray-800 whitespace-pre-wrap">{entry.mensaje}</p>
                                        {entry.adjuntoUrl && <a href={entry.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver adjunto</a>}
                                        <p className="text-gray-500 mt-1 text-right">{entry.autorNombre} - {formatDate(entry.fecha)}</p>
                                    </div>
                                )) : <p className="text-gray-500">No hay entradas.</p>}
                            </div>
                        </div>
                    )}    
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 font-bold py-2 px-4 rounded">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
                </div>
            </div>
        </div>
    );
};


// componente para filtrado avanzado, para cambiar la busqueda simple
/*
const ProjectFilters = ({ projects, techniciansMap, onFilterChange }) => {
    const clients = [...new Set(projects.map(p => p.clienteNombre))].sort();
    const technicianList = Object.entries(techniciansMap || {}).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

    const handleFilter = (filterName, value) => {
        onFilterChange(filterName, value);
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="font-semibold text-gray-700">Filtrar por:</span>
            
            <div>
                <label htmlFor="npu-filter" className="text-sm font-medium text-gray-600 mr-2">NPU:</label>
                <input
                    id="npu-filter"
                    type="text"
                    onChange={(e) => handleFilter('npu', e.target.value)}
                    placeholder="Buscar NPU..."
                    className="border-gray-300 rounded-md p-2 text-sm"
                />
            </div>

            <div>
                <label htmlFor="client-filter" className="text-sm font-medium text-gray-600 mr-2">Cliente:</label>
                <select id="client-filter" onChange={(e) => handleFilter('cliente', e.target.value)} className="border-gray-300 rounded-md p-2 text-sm">
                    <option value="">Todos</option>
                    {clients.map(client => <option key={client} value={client}>{client}</option>)}
                </select>
            </div>

            <div>
                <label htmlFor="tech-filter" className="text-sm font-medium text-gray-600 mr-2">Técnico:</label>
                <select id="tech-filter" onChange={(e) => handleFilter('tecnico', e.target.value)} className="border-gray-300 rounded-md p-2 text-sm">
                    <option value="">Todos</option>
                    {technicianList.map(tech => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
                </select>
            </div>

             <div>
                <label htmlFor="status-filter" className="text-sm font-medium text-gray-600 mr-2">Estado:</label>
                <select id="status-filter" onChange={(e) => handleFilter('estadoEntrega', e.target.value)} className="border-gray-300 rounded-md p-2 text-sm">
                    <option value="">Todos</option>
                    <option value="Atrasado">Atrasado</option>
                    <option value="Por Vencer">Por Vencer</option>
                    <option value="A Tiempo">A Tiempo</option>
                    <option value="Sin Fecha">Sin Fecha</option>
                </select>
            </div>
        </div>
    );
};
*/

// modal para acciones que necesitan una razón por escrito (ej. rechazar un proyecto).
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

// El Header o cabecera de la página. Muestra el logo y el botón de salir.
// También contiene el nuevo selector de roles para usuarios con más de uno.
const Header = ({ user, userData, selectedRole, setSelectedRole, isWorking, selectedClientProfile, setSelectedClientProfile }) => {
    const logoGrupoEvelsa = "https://www.grupoevelsa.com/assets/images/Logo Evelsa 2.png";
    const hasMultipleRoles = userData?.roles && userData.roles.length > 1;
    const hasMultipleClients = userData?.clientesAsociados && userData.clientesAsociados.length > 1;
    const [clientProfiles, setClientProfiles] = useState([]);

    useEffect(() => {
        if (hasMultipleClients) {
            const fetchProfiles = async () => {
                const profilePromises = userData.clientesAsociados.map(id => getDoc(doc(db, "usuarios", id)));
                const profileSnapshots = await Promise.all(profilePromises);
                setClientProfiles(profileSnapshots.map(doc => ({ id: doc.id, ...doc.data() })));
            };
            fetchProfiles();
        }
    }, [userData, hasMultipleClients]);
    

    const handleClientChange = async (e) => {
        const newProfileId = e.target.value;
        const profile = clientProfiles.find(p => p.id === newProfileId);
        setSelectedClientProfile(profile);
    };

    const handleSafeSignOut = () => {
        signOut(auth);
    };

    useEffect(() => {
        if (!user?.uid) return;

        const notificationSound = new Audio('https://freesound.org/data/previews/131/131660_2398463-lq.mp3');

        const q = query(
            collection(db, "notificaciones"),
            where("recipientId", "==", user.uid),
            where("read", "==", false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newNotifications = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    newNotifications.push({ id: change.doc.id, ...change.doc.data() });
                }
            });

            if (newNotifications.length > 2) {
                toast.info(`🔔 Tienes ${newNotifications.length} notificaciones nuevas sin leer.`);
                notificationSound.play().catch(e => console.log("La interacción del usuario es necesaria para reproducir sonido."));
            } else {
                newNotifications.forEach((notif, index) => {
                    setTimeout(() => {
                        toast.info(`🔔 ${notif.message}`);
                        notificationSound.play().catch(e => console.log("La interacción del usuario es necesaria para reproducir sonido."));
                    }, index * 1000);
                });
            }

            if (newNotifications.length > 0) {
                const batch = writeBatch(db);
                newNotifications.forEach(notif => {
                    const notifRef = doc(db, "notificaciones", notif.id);
                    batch.update(notifRef, { read: true });
                });
                batch.commit();
            }
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                <div className="flex items-center">
                    {selectedClientProfile && selectedClientProfile.rol === 'cliente' && selectedClientProfile.logoUrl ? (
                        <img src={selectedClientProfile.logoUrl} onError={(e)=>{e.target.onerror = null; e.target.src="https://placehold.co/150x50/FFFFFF/000000?text=Logo+Cliente"}} alt="Logo Cliente" className="h-12 w-auto mr-4 object-contain"/>
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

                        {hasMultipleClients && selectedRole === 'cliente' && (
                            <div className="relative">
                                <select 
                                    value={selectedClientProfile?.id || ''}
                                    onChange={handleClientChange}
                                    className="appearance-none bg-gray-100 border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-200"
                                >
                                    {clientProfiles.map(profile => (
                                        <option key={profile.id} value={profile.id}>
                                            {profile.planta || profile.nombreCompleto}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <button 
                            onClick={handleSafeSignOut} 
                            disabled={isWorking} 
                            className={`font-bold py-2 px-4 rounded-lg transition duration-300 ${
                                isWorking ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                            title={isWorking ? "Debes 'Finalizar Día' antes de salir" : "Cerrar sesión"}
                        >
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

// componente servicios alta y consulta para el panel del administrador
const ServiceManagement = () => {
    const [services, setServices] = useState([]);
    const [newItem, setNewItem] = useState({
        nombre: '',
        servicioIdNumerico: '',
        dependencia: '',
        durationType: 'fixed',
        totalHoras: '',
        baseHoras: '',
        porUnidad: '',
        nombreUnidad: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const q = query(collection(db, "servicios"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => {
            setError("No se pudieron cargar los servicios.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setNewItem(prev => ({
            ...prev,
            [name]: type === 'radio' ? value : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newItem.nombre || !newItem.servicioIdNumerico || !newItem.dependencia) {
            setError('Nombre, ID Numérico y Dependencia son obligatorios.');
            return;
        }

        let calculoDuracion = {};
        if (newItem.durationType === 'fixed') {
            if (!newItem.totalHoras) {
                setError('Debe especificar las horas totales para duración fija.');
                return;
            }
            calculoDuracion = { totalHoras: Number(newItem.totalHoras) };
        } else {
            if (!newItem.baseHoras || !newItem.porUnidad || !newItem.nombreUnidad) {
                setError('Horas base, valor por unidad y nombre de unidad son obligatorios para duración variable.');
                return;
            }
            calculoDuracion = {
                baseHoras: Number(newItem.baseHoras),
                porUnidad: Number(newItem.porUnidad),
                nombreUnidad: newItem.nombreUnidad,
            };
        }

        try {
            await addDoc(collection(db, "servicios"), {
                nombre: newItem.nombre,
                servicioIdNumerico: newItem.servicioIdNumerico,
                dependencia: newItem.dependencia,
                calculoDuracion: calculoDuracion,
            });
            setSuccess(`¡Servicio '${newItem.nombre}' añadido con éxito!`);
            setNewItem({
                nombre: '', servicioIdNumerico: '', dependencia: '', durationType: 'fixed',
                totalHoras: '', baseHoras: '', porUnidad: '', nombreUnidad: '',
            });
        } catch (err) {
            setError(`Error al añadir el servicio: ${err.message}`);
        }
    };

    const displayDuration = (service) => {
        const calc = service.calculoDuracion;
        if (!calc) return 'N/A';
        if (calc.totalHoras) {
            return `${calc.totalHoras}h Total`;
        }
        if (calc.baseHoras !== undefined) {
            return `${calc.baseHoras}h + ${calc.porUnidad}h/${calc.nombreUnidad || 'unidad'}`;
        }
        return 'Inválido';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border">
                <h3 className="text-xl font-bold mb-4">Añadir Nuevo Servicio</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" name="nombre" value={newItem.nombre} onChange={handleChange} placeholder="Nombre del Servicio" className="w-full p-2 border rounded" required />
                    <input type="text" name="servicioIdNumerico" value={newItem.servicioIdNumerico} onChange={handleChange} placeholder="ID Numérico (ej: 0001)" className="w-full p-2 border rounded" required />
                    <input type="text" name="dependencia" value={newItem.dependencia} onChange={handleChange} placeholder="Dependencia" className="w-full p-2 border rounded" required />
                    
                    <fieldset className="border p-3 rounded">
                        <legend className="text-sm font-medium">Tipo de Duración</legend>
                        <div className="flex space-x-4">
                            <label><input type="radio" name="durationType" value="fixed" checked={newItem.durationType === 'fixed'} onChange={handleChange} /> Fija</label>
                            <label><input type="radio" name="durationType" value="variable" checked={newItem.durationType === 'variable'} onChange={handleChange} /> Variable</label>
                        </div>
                    </fieldset>

                    {newItem.durationType === 'fixed' && (
                        <input type="number" name="totalHoras" value={newItem.totalHoras} onChange={handleChange} placeholder="Horas Totales Estimadas" className="w-full p-2 border rounded" />
                    )}

                    {newItem.durationType === 'variable' && (
                        <div className="space-y-2 border p-3 rounded bg-gray-50">
                            <input type="number" name="baseHoras" value={newItem.baseHoras} onChange={handleChange} placeholder="Horas Base" className="w-full p-2 border rounded" />
                            <input type="number" step="0.01" name="porUnidad" value={newItem.porUnidad} onChange={handleChange} placeholder="Horas por Unidad (ej: 0.75)" className="w-full p-2 border rounded" />
                            <input type="text" name="nombreUnidad" value={newItem.nombreUnidad} onChange={handleChange} placeholder="Nombre de la Unidad (ej: punto, foto)" className="w-full p-2 border rounded" />
                        </div>
                    )}

                    <Alert message={error} type="error" onClose={() => setError('')} />
                    <Alert message={success} type="success" onClose={() => setSuccess('')} />
                    <button type="submit" className="w-full bg-[#b0ef26] hover:bg-[#9ac91e] font-bold py-2 px-4 rounded">Añadir Servicio</button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border">
                <h3 className="text-xl font-bold mb-4">Servicios Existentes</h3>
                <div className="overflow-y-auto max-h-96">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Nombre</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">ID Num.</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Dependencia</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase">Duración Estimada</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y">
                            {loading ? <tr><td colSpan="4">Cargando...</td></tr> : services.map(service => (
                                <tr key={service.id}>
                                    <td className="px-4 py-2 text-sm">{service.nombre}</td>
                                    <td className="px-4 py-2 text-sm">{service.servicioIdNumerico}</td>
                                    <td className="px-4 py-2 text-sm">{service.dependencia}</td>
                                    <td className="px-4 py-2 text-sm">{displayDuration(service)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// componente de usuarios alta para formulario en el panel del admistrador
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

// El dashboard del Administrador. Contiene las pestañas para gestionar proyectos, usuarios, servicios, proveedores.
const AdminDashboard = ({ user, userData, selectedRole }) => {
    const [view, setView] = useState('projects');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [managedProject, setManagedProject] = useState(null);

    const refreshData = () => {
        setLoading(true);
        const qProjects = query(collection(db, PROYECTOS_COLLECTION), orderBy("fechaApertura", "desc"));
        const unsubscribe = onSnapshot(qProjects, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return unsubscribe;
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
                    {loading ? <p>Cargando tabla...</p> : <ProjectsTable projects={projects} onUpdateProject={refreshData} userRole="administrador" selectedRole={selectedRole} onManageClick={setManagedProject} />}
                </>
            )}

            {view === 'services' && <ServiceManagement />}
            {view === 'providers' && <DataManagement collectionName="proveedores" title="Proveedores" fields={['nombre', 'proveedorIdNumerico']} placeholderTexts={['Nombre del Proveedor', 'ID Numérico (ej: 01)']} />}
            
            {managedProject && 
                <ProjectManagementModal 
                    project={managedProject} 
                    onClose={() => setManagedProject(null)} 
                    onUpdate={refreshData} 
                    user={user} 
                    userData={userData} 
                    userRole="administrador" 
                />
            }

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
        costoProveedor: '',
        cotizacionClienteRef: '',
        poClienteRef: '',
        cotizacionProveedorRef: '',
        cantidadUnidades: 1,
    });

    const [selectedService, setSelectedService] = useState(null);
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

        if (name === "servicioId") {
            const service = collections.servicios.find(s => s.id === value);
            setSelectedService(service);
        }
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
            let horasEstimadas = 0;
            if (selectedService && selectedService.calculoDuracion) {
                if (selectedService.calculoDuracion.totalHoras) {
                    horasEstimadas = selectedService.calculoDuracion.totalHoras;
                } else if (selectedService.calculoDuracion.baseHoras !== undefined) {
                    const base = selectedService.calculoDuracion.baseHoras || 0;
                    const porUnidad = selectedService.calculoDuracion.porUnidad || 0;
                    const cantidad = Number(formData.cantidadUnidades) || 1;
                    horasEstimadas = base + (porUnidad * cantidad);
                }
            }

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

            await addDoc(collection(db, PROYECTOS_COLLECTION), {
                npu: npu,
                clienteId: formData.clienteId,
                clienteNombre: cliente.nombreCompleto,
                servicioId: formData.servicioId,
                servicioNombre: servicio.nombre,
                proveedorId: formData.proveedorId,
                proveedorNombre: proveedor.nombre,
                fechaApertura: Timestamp.fromDate(new Date(formData.fechaApertura)),
                estado: formData.poClienteRef ? 'Activo' : 'Cotización',
                prioridad: "1 - Normal",
                dependencia: servicio.dependencia || 'Sin Dependencia',
                precioCotizacionCliente: Number(formData.precioCotizacionCliente) || 0,
                costoProveedor: Number(formData.costoProveedor) || 0,
                horasEstimadas: horasEstimadas,
                horasRegistradas: 0,
                facturasClienteIds: [],
                facturasProveedorIds: [],
                faseFacturacion: 'N/A',
                cotizacionClienteRef: formData.cotizacionClienteRef,
                poClienteRef: formData.poClienteRef,
                cotizacionProveedorRef: formData.cotizacionProveedorRef,
                poProveedor: isInternalProvider ? "N/A" : npu.slice(-8),
                cantidadUnidades: (selectedService?.calculoDuracion?.porUnidad) ? Number(formData.cantidadUnidades) : null,
                asignadoTecnicosIds: [],
                comentariosApertura: formData.comentariosApertura,
                fechaAsignacionTecnico: null,
                fechaEntregaInterna: null,
                notasSupervisor: "",
                fechaFinTecnicoReal: null,
            });
            
            setFormData({
                clienteId: '', servicioId: '', proveedorId: '', comentariosApertura: '',
                fechaApertura: new Date().toISOString().split('T')[0],
                precioCotizacionCliente: '', costoProveedor: '', cotizacionClienteRef: '',
                poClienteRef: '', cotizacionProveedorRef: '', cantidadUnidades: 1,
            });
            setSelectedService(null);
            formRef.current.reset();
            if (onProjectAdded) onProjectAdded();

        } catch (err) {
            console.error("Error al crear proyecto:", err);
            setError(`Ocurrió un error: ${err.message}`);
        }
        setLoading(false);
    };

    const showUnitsInput = selectedService && selectedService.calculoDuracion && selectedService.calculoDuracion.porUnidad;

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
                    {showUnitsInput && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 capitalize">
                                Cantidad de {selectedService.calculoDuracion.nombreUnidad || 'Unidades'}
                            </label>
                            <input type="number" name="cantidadUnidades" value={formData.cantidadUnidades} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                    )}                
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700">Información del Cliente</h4>
                        <input type="number" name="precioCotizacionCliente" value={formData.precioCotizacionCliente} onChange={handleChange} placeholder="Precio Cotización (con IVA)" className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        <input type="text" name="cotizacionClienteRef" value={formData.cotizacionClienteRef} onChange={handleChange} placeholder="Nº o Referencia de Cotización" className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        <input type="text" name="poClienteRef" value={formData.poClienteRef} onChange={handleChange} placeholder="Nº de Orden de Compra (PO)" className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-700">Información del Proveedor</h4>
                        <input type="number" name="costoProveedor" value={formData.costoProveedor} onChange={handleChange} placeholder="Costo (con IVA)" disabled={isInternalProvider} className="mt-1 block w-full px-3 py-2 border rounded-md disabled:bg-gray-100"/>
                        <input type="text" name="cotizacionProveedorRef" value={formData.cotizacionProveedorRef} onChange={handleChange} placeholder="Nº o Ref. de Cotización Proveedor" disabled={isInternalProvider} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
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

const ProjectsTable = ({projects, onUpdateProject, userRole, supervisorView, onManageClick, onAssignClick, user, userData, selectedRole}) => {
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [techniciansMap, setTechniciansMap] = useState({});
    const [invoicesMap, setInvoicesMap] = useState({});
    const [confirmingAction, setConfirmingAction] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchExtraData = () => {
            const qTechsOld = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
            const qTechsNew = query(collection(db, "usuarios"), where("roles", "array-contains", "tecnico"));
            const unsubTechs = onSnapshot(qTechsNew, (snapshotNew) => {
                const techMap = {};
                snapshotNew.forEach(doc => { techMap[doc.id] = doc.data().nombreCompleto; });
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

    const handleToggleRow = (projectId) => {
        setExpandedRowId(prevId => (prevId === projectId ? null : projectId));
    }; 
    
    const filteredProjects = userRole === 'administrador'
    ? projects.filter(p => (p.npu?.toLowerCase().includes(searchTerm.toLowerCase())) || (p.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase())) || (p.servicioNombre?.toLowerCase().includes(searchTerm.toLowerCase())))
    : projects;

    const currentItems = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    
    const handleActivateProject = async (projectId) => {
        await updateDoc(doc(db, PROYECTOS_COLLECTION, projectId), { estado: 'Activo', estadoCliente: 'Activo' });
    };

    const handleDeleteProject = async (projectId) => {
        await deleteDoc(doc(db, PROYECTOS_COLLECTION, projectId));
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
            {userRole === 'administrador' && (
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
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            )}
            
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {userRole === 'supervisor' && supervisorView === 'new' && (
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Apertura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        )}

                        {userRole === 'supervisor' && supervisorView === 'techDetail' && (
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase">Prioridad</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase">Horas (Reg/Est)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase">Servicio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase">Ver Más</th>
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref. Cliente</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref. Proveedor</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fact. Cliente</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fact. Proveedor</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            )}
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(project => {
                            const isExpanded = expandedRowId === project.id;
                            let deliveryStatus = 'A Tiempo';
                            if (userRole === 'supervisor') {
                                const today = new Date(); today.setHours(0,0,0,0);
                                const dueDate = project.fechaEntregaInterna?.toDate();
                                if (!dueDate) {
                                    deliveryStatus = 'Sin Fecha';
                                } else {
                                    dueDate.setHours(0,0,0,0);
                                    if (dueDate < today) deliveryStatus = 'Atrasado';
                                    else if ((dueDate - today) / (1000 * 60 * 60 * 24) <= 3) deliveryStatus = 'Por Vencer';
                                }
                            }
                            const isEcotech = project.proveedorNombre?.toLowerCase().includes('ecotech');

                            return (
                                <React.Fragment key={project.id}>
                                    <tr className={isExpanded ? 'bg-blue-50' : ''}>
                                        {userRole === 'administrador' && (
                                                <>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(project.fechaApertura)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{project.npu}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{project.proveedorNombre}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.datosEcotech?.numeroProyecto || '---'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500" title={project.comentariosApertura}>
                                                        <p className="w-32 truncate">{project.comentariosApertura || '---'}</p>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{project.poProveedor}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-green-600">${(project.precioCotizacionCliente || 0).toFixed(2)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">${(project.costoProveedor || 0).toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-xs">
                                                        <p><strong>Cot:</strong> {project.cotizacionClienteRef || 'N/A'}</p>
                                                        <p><strong>PO:</strong> {project.poClienteRef || 'N/A'}</p>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs">
                                                        <p><strong>Cot:</strong> {project.cotizacionProveedorRef || 'N/A'}</p>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{invoicesMap[project.facturaClienteId] || '---'}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm">{invoicesMap[project.facturaProveedorId] || (project.proveedorNombre?.toLowerCase().trim() === "ecologia y asesoria ambiental" ? 'N/A' : '---')}</td>
                                                    <td className="px-4 py-2"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${project.estado === 'Activo' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>{project.estado}</span></td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center space-x-4">
                                                            {project.estado === 'Cotización' && <button onClick={() => handleActivateProject(project.id)} className="text-green-600">Activar</button>}
                                                            <button onClick={() => onManageClick(project)} className="text-indigo-600">Gestionar</button>
                                                            {project.estado !== 'Terminado' && project.estado !== 'Archivado' && <button onClick={() => promptDeleteProject(project.id, project.npu)} className="text-red-600">Borrar</button>}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                        {userRole === 'supervisor' && supervisorView === 'new' && (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(project.fechaApertura)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{project.npu}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                                <td className="px-4 py-2">
                                                    <button onClick={() => onAssignClick(project)} className="text-indigo-600 font-medium">Asignar</button>
                                                </td>
                                            </>    
                                        )}
                                        {userRole === 'supervisor' && supervisorView === 'techDetail' && (
                                            <>
                                                <td className="px-4 py-3"><StatusBadge status={deliveryStatus} /></td>
                                                <td className="px-4 py-3 text-sm">{project.prioridad || '1 - Normal'}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="font-semibold">{(project.horasRegistradas || 0).toFixed(1)}h</span> / 
                                                    <span className="text-gray-600">{(project.horasEstimadas || 0).toFixed(1)}h</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">{project.servicioNombre}</td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => handleToggleRow(project.id)} className="text-indigo-600 font-medium">
                                                        {expandedRowId === project.id ? 'Ocultar' : 'Detalles...'}
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                        {isExpanded && (
                                            <tr className="bg-gray-50 border-b-2 border-blue-200">
                                                <td colSpan="5" className="p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                    <div><p className="font-semibold">Cliente:</p><p>{project.clienteNombre}</p></div>
                                                    <div><p className="font-semibold">Fecha Límite (Supervisor):</p><p>{formatDate(project.fechaEntregaInterna)}</p></div>
                                                    <div>
                                                        <p className="font-semibold">Estado Detallado:</p>
                                                        {project.fechaFinTecnicoReal ? (
                                                            <p className="text-purple-800">Técnico finalizó el {formatDate(project.fechaFinTecnicoReal)}. En espera de proveedor.</p>
                                                        ) : (
                                                            <p className="text-gray-600">El técnico está trabajando en el proyecto.</p>
                                                        )}
                                                    </div>
                                                    <div className="col-span-full"><p className="font-semibold">Notas del Supervisor:</p><p className="text-gray-600 whitespace-pre-wrap">{project.notasSupervisor || 'No hay notas.'}</p></div>
                                                        {isEcotech && (
                                                            <div className="col-span-3 border-t pt-2 mt-2">
                                                                <p className="font-semibold text-gray-800">Info Ecotech:</p>
                                                                <p><strong>Nº Proy:</strong> {project.datosEcotech?.numeroProyecto || 'N/A'}, <strong>Puntos:</strong> {project.datosEcotech?.puntosDeTrabajo || 'N/A'}, <strong>Estatus:</strong> {project.datosEcotech?.estatus || 'N/A'}</p>
                                                            </div>
                                                        )}
                                                        <div className="col-span-full flex justify-end items-center space-x-4 border-t pt-3 mt-2">
                                                            <button onClick={() => onAssignClick(project)} className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600">
                                                                Reasignar Técnico
                                                            </button>
                                                            <button onClick={() => onManageClick(project)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                                                                Gestionar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
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
                
                {confirmingAction && <ConfirmationModal {...confirmingAction} onCancel={() => setConfirmingAction(null)} />}
        </>
    );
};

const ReviewProjectsTable = ({ projects, onUpdateProject }) => {
    const [confirmingAction, setConfirmingAction] = useState(null);

    const handleApprove = async () => {
        if (!confirmingAction || confirmingAction.action !== 'approve') return;
        const { project } = confirmingAction.payload;
        const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);

        const isPreliminaryDelivery = project.fase1_fechaFinTecnico && !project.fase2_fechaFinTecnico;
        
        if (isPreliminaryDelivery) {

            await updateDoc(projectRef, { 
                estado: 'Pendiente de Factura', 
                faseFacturacion: 'Preliminar',
                estadoCliente: 'Terminado'
            });
        } else {

            if (project.faseFacturacion === 'Preliminar' || project.faseFacturacion === 'Fase 2 Pendiente') {
                await updateDoc(projectRef, { estado: 'Archivado', estadoCliente: 'Terminado' });
            } else {
                await updateDoc(projectRef, { estado: 'Pendiente de Factura', estadoCliente: 'Terminado' });
            }
        }
        
        setConfirmingAction(null);
        onUpdateProject();
    };

    const handleReject = async (reason) => {
        if (!confirmingAction || confirmingAction.action !== 'reject') return;
        const { projectId } = confirmingAction.payload;

        if (reason && reason.trim() !== '') {
            const projectRef = doc(db, PROYECTOS_COLLECTION, projectId);
            await updateDoc(projectRef, { estado: 'Terminado Internamente', motivoRechazo: reason });
            onUpdateProject();
        } else {
            alert("El motivo del rechazo no puede estar vacío.");
            return;
        }
        setConfirmingAction(null);
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos Finales</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {projects.map(project => (
                             <tr key={project.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex space-x-4">
                                        <button onClick={() => promptApprove(project)} className="text-green-600 hover:text-green-900">Aprobar</button>
                                        <button onClick={() => promptReject(project.id)} className="text-orange-600 hover:text-orange-900">Rechazar</button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="flex flex-col space-y-1">
                                        {project.urlHeyzine && <a href={project.urlHeyzine} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Proyecto (Heyzine)</a>}
                                        {project.fase1_urlNotaEntregaFirmada && <a href={project.fase1_urlNotaEntregaFirmada} target="_blank" rel="noopener noreferrer" className="text-red-600">Ver Nota 1 (Firmada)</a>}
                                        {project.fase2_urlNotaEntregaFirmada && <a href={project.fase2_urlNotaEntregaFirmada} target="_blank" rel="noopener noreferrer" className="text-red-600">Ver Nota 2 (Firmada)</a>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{project.npu}</td>
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
                                        {project.urlNotaPdf1 && <a href={project.urlNotaPdf1} download className="text-sm font-medium text-red-600 hover:text-red-900">Nota Preliminar</a>}
                                        {project.urlNotaPdf2 && <a href={project.urlNotaPdf2} download className="text-sm font-medium text-red-600 hover:text-red-900">Nota Final</a>}
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
        if (!userData || !userData.id) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        const q = query(
            collection(db, PROYECTOS_COLLECTION), 
            where("clienteId", "==", userData.id), 
            where("estadoCliente", "in", ["Activo", "Terminado"])
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            projectsData.sort((a, b) => (b.fechaApertura?.seconds || 0) - (a.fechaApertura?.seconds || 0));
            setProjects(projectsData);
            setLoading(false);
        
        
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
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [userData]);

    if (!userData) {
        return <div className="text-center py-10">Cargando perfil...</div>;
    }

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

 //Componente para renderizar la gráfica de Pipeline de Proyectos recibe los datos ya procesados y listos para mostrar.
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
        // Estados de Entrega
        'Atrasado': 'bg-red-100 text-red-800',
        'Por Vencer': 'bg-orange-100 text-orange-800',
        'A Tiempo': 'bg-green-100 text-green-800',
        'En Espera de Proveedor': 'bg-purple-100 text-purple-800',
        'Sin Fecha': 'bg-gray-100 text-gray-600',
        // Estados Generales del Proyecto
        'Activo': 'bg-orange-100 text-orange-800',
        'En Revisión Final': 'bg-blue-100 text-blue-800',
        'Terminado Internamente': 'bg-indigo-100 text-indigo-800',
        'Pendiente de Factura': 'bg-yellow-100 text-yellow-800',
        'Facturado': 'bg-green-100 text-green-800',
        'Archivado': 'bg-gray-100 text-gray-700',
        'Cotización': 'bg-gray-200 text-gray-800',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || 'bg-gray-100'}`}>{status}</span>;
};

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const OperationalReportTable = ({ projects, techniciansMap }) => {
    const currentYear = new Date().getFullYear();
    const monthOptions = [
        { value: '', label: 'Todos los Meses' },
        ...monthNames.map((name, index) => ({ value: String(index), label: name }))
    ];
    const [reportType, setReportType] = useState('delivered');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [techFilter, setTechFilter] = useState('');

    const technicianOptions = React.useMemo(() => {
        if (!techniciansMap) return [];
        return Object.values(techniciansMap)
                     .filter((name, index, self) => self.indexOf(name) === index)
                     .sort()
                     .map(name => ({ value: name, label: name }));
    }, [techniciansMap]);

    const { filteredProjects, totalSum, totalLabel } = React.useMemo(() => {
        let filtered = [];
        if (reportType === 'delivered') {
            filtered = projects.filter(p => {
                const deliveryDate = p.fase1_fechaFinTecnico?.toDate() || p.fase2_fechaFinTecnico?.toDate();
                if (!deliveryDate) return false;
                const yearMatch = deliveryDate.getFullYear() === selectedYear;
                const monthMatch = !selectedMonth || deliveryDate.getMonth() === parseInt(selectedMonth, 10);
                return yearMatch && monthMatch;
            });
        } else {
            filtered = projects.filter(p => {
                const dueDate = p.fechaEntregaInterna?.toDate();
                if (!dueDate) return false;
                const statusMatch = p.estado === 'Activo' && !p.fechaFinTecnicoReal;
                const yearMatch = dueDate.getFullYear() === selectedYear;
                const monthMatch = !selectedMonth || dueDate.getMonth() === parseInt(selectedMonth, 10);
                return statusMatch && yearMatch && monthMatch;
            });
        }

        if (techFilter) {
            filtered = filtered.filter(p => p.responsableNombre === techFilter);
        }
        
        const sum = filtered.reduce((acc, p) => acc + (p.precioCotizacionCliente || 0), 0);
        
        filtered.sort((a, b) => {
            const dateA = (reportType === 'delivered' ? (a.fase2_fechaFinTecnico || a.fase1_fechaFinTecnico) : a.fechaEntregaInterna)?.toDate() || 0;
            const dateB = (reportType === 'delivered' ? (b.fase2_fechaFinTecnico || b.fase1_fechaFinTecnico) : b.fechaEntregaInterna)?.toDate() || 0;
            return dateB - dateA;
        });

        const label = selectedMonth ? `${monthNames[parseInt(selectedMonth, 10)]} ${selectedYear}` : `Todo ${selectedYear}`;
        
        return { filteredProjects: filtered, totalSum: sum, totalLabel: label };
    }, [projects, reportType, selectedMonth, selectedYear, techFilter]);

    const currentItems = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border flex flex-wrap items-center gap-x-6 gap-y-4">
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Ver:</label>
                    <select value={reportType} onChange={e => { setReportType(e.target.value); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                        <option value="delivered">Entregados en</option>
                        <option value="pending">Pendientes para</option>
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Mes:</label>
                    <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                        {monthOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                 <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Año:</label>
                    <select value={selectedYear} onChange={e => { setSelectedYear(parseInt(e.target.value, 10)); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                         {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium">Responsable:</label>
                    <select value={techFilter} onChange={e => { setTechFilter(e.target.value); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                        <option value="">Todos</option>
                        {technicianOptions.map(tech => <option key={tech.value} value={tech.value}>{tech.label}</option>)}
                    </select>
                </div>
                 <div className="flex items-center space-x-2 ml-auto">
                    <span className="text-sm">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option><option value={15}>15</option><option value={25}>25</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Cliente</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Proyecto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Monto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Responsable</th>
                            {reportType === 'pending' && (
                                <>
                                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Estatus Entrega</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium uppercase">Notas Supervisor</th>
                                </>
                            )}
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">{reportType === 'delivered' ? 'Nota Entrega' : 'Fecha Límite'}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(p => (
                            <tr key={p.id}>
                                <td className="px-4 py-2">{p.clienteNombre}</td>
                                <td className="px-4 py-2">{p.servicioNombre}</td>
                                <td className="px-4 py-2 font-semibold">${(p.precioCotizacionCliente || 0).toFixed(2)}</td>
                                <td className="px-4 py-2">{p.responsableNombre}</td>
                                {reportType === 'pending' && (
                                    <>
                                        <td className="px-4 py-2"><StatusBadge status={p.deliveryStatus} /></td>
                                        <td className="px-4 py-2 text-sm" title={p.notasSupervisor}>
                                            <p className="w-32 truncate">{p.notasSupervisor || '---'}</p>
                                        </td>
                                    </>
                                )}
                                <td className="px-4 py-2">{reportType === 'delivered' ? p.notaEntregaNumero : formatDate(p.fechaEntregaInterna)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t-2">
                        <tr>
                            <td className="px-4 py-3 font-bold text-right text-sm" colSpan="2">
                                Total {reportType === 'delivered' ? 'Entregado' : 'Pendiente'} ({totalLabel}):
                            </td>
                            <td className="px-4 py-3 font-bold text-lg text-gray-900">${totalSum.toFixed(2)}</td>
                            <td colSpan={reportType === 'delivered' ? 2 : 4}></td>
                        </tr>
                    </tfoot>
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

// Componente que para crear la tabla de cuentas por cobrar
const FinancialTrackingTable = ({ title, invoices, getInvoiceStatusBadge }) => {
    const [statusFilter, setStatusFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10)

    const { filteredInvoices, totalSum } = React.useMemo(() => {
        let filtered = statusFilter
            ? invoices.filter(inv => inv.estado === statusFilter)
            : invoices;

        if (monthFilter) {
            const selectedMonth = parseInt(monthFilter, 10);
            filtered = filtered.filter(inv => inv.fechaPromesaPago?.toDate().getMonth() === selectedMonth);
        }

        const sum = filtered.reduce((acc, inv) => acc + (inv.monto || 0), 0);
        return { filteredInvoices: filtered, totalSum: sum };
    }, [invoices, statusFilter, monthFilter]);

    const monthOptions = React.useMemo(() => {
        const availableMonths = new Set();
        invoices.forEach(inv => {
            if (inv.fechaPromesaPago?.toDate) {
                availableMonths.add(inv.fechaPromesaPago.toDate().getMonth());
            }
        });

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        
        const options = Array.from(availableMonths)
            .sort((a, b) => a - b)
            .map(monthNumber => ({
                value: String(monthNumber),
                label: monthNames[monthNumber]
            }));

        return [{ value: '', label: 'Todos los Meses' }, ...options];
    }, [invoices]);

    const currentItems = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
            <div className="mb-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <label htmlFor={`${title}-status-filter`} className="text-sm font-medium">Estado:</label>
                    <select id={`${title}-status-filter`} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                        <option value="">Todos</option>
                        <option value="Pend. de Autorización">Pend. Autorización</option>
                        <option value="Prog. a Pago">Prog. a Pago</option>
                        <option value="Vencida">Vencida</option>
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                    <label htmlFor={`${title}-month-filter`} className="text-sm font-medium">Mes Pago Prog.:</label>
                    <select id={`${title}-month-filter`} value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }} className="border-gray-300 rounded-md p-2 text-sm">
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                 <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Estado</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Monto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Fecha Prog. Pago</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Planta</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Servicio</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase">Factura</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(inv => (
                            <tr key={inv.id}>
                                <td className="px-4 py-2">{getInvoiceStatusBadge(inv.estado)}</td>
                                <td className="px-4 py-2 font-semibold text-gray-900">${(inv.monto || 0).toFixed(2)}</td>
                                <td className="px-4 py-2">{formatDate(inv.fechaPromesaPago)}</td>
                                <td className="px-4 py-2">{inv.planta || 'N/A'}</td>
                                <td className="px-4 py-2">{inv.servicio || 'General'}</td>
                                <td className="px-4 py-2">{inv.folio}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                        <tr>
                            <td className="px-4 py-3 font-bold text-right">Total:</td>
                            <td className="px-4 py-3 font-bold text-lg text-gray-900" colSpan="4">${totalSum.toFixed(2)}</td>
                        </tr>
                    </tfoot>
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

// Componente que para crear la tabla de cuentas por pagar
const AccountsPayableDirectiveTable = ({ invoices, projectsMap }) => {
    const [providerFilter, setProviderFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { processedInvoices, totalSum } = React.useMemo(() => {
        const activeInvoices = invoices.filter(inv =>
            inv.estado === 'Pend. de Autorización' || inv.estado === 'Prog. a Pago' || inv.estado === 'Vencida'
        );

        const filteredByProvider = providerFilter
            ? activeInvoices.filter(inv => inv.proveedorNombre === providerFilter)
            : activeInvoices;

        const sum = filteredByProvider.reduce((acc, inv) => acc + (inv.monto || 0), 0);

        const finalInvoices = filteredByProvider.map(inv => {
            let projectBillingStatus = 'N/A';
            if (inv.proyectoId && inv.proyectoId !== 'general') {
                const project = projectsMap.get(inv.proyectoId);
                projectBillingStatus = (project && project.facturasClienteIds && project.facturasClienteIds.length > 0)
                    ? 'Facturado'
                    : 'No Facturado';
            }
            return { ...inv, projectBillingStatus };
        });

        return { processedInvoices: finalInvoices, totalSum: sum };
    }, [invoices, providerFilter, projectsMap]);

    const currentItems = processedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(processedInvoices.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const providers = [...new Set(invoices.map(inv => inv.proveedorNombre))].sort();

    const getInvoiceStatusBadge = (status) => {
        const styles = {
            'Prog. a Pago': 'bg-blue-100 text-blue-800',
            'Pend. de Autorización': 'bg-yellow-100 text-yellow-800',
            'Vencida': 'bg-red-100 text-yellow-800',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
    };
     const getProjectBillingStatusBadge = (status) => {
        const styles = {
            'Facturado': 'bg-green-100 text-green-800',
            'No Facturado': 'bg-red-100 text-red-800',
            'N/A': 'bg-gray-100 text-gray-700',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
    };


    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Cuentas por Pagar</h2>
            <div className="mb-4 flex justify-between items-center">
                <div>
                    <label htmlFor="provider-filter" className="text-sm font-medium mr-2">Filtrar por Proveedor:</label>
                    <select
                        id="provider-filter"
                        value={providerFilter}
                        onChange={(e) => { setProviderFilter(e.target.value); setCurrentPage(1); }}
                        className="border-gray-300 rounded-md p-2 text-sm"
                    >
                        <option value="">Todos</option>
                        {providers.map(prov => <option key={prov} value={prov}>{prov}</option>)}
                    </select>
                </div>
                 <div className="flex items-center">
                    <span className="text-sm mr-2">Mostrar:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium">Factura</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Proveedor</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Monto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Fecha Prog. Pago</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Estatus</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Estatus Cobro</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentItems.map(inv => (
                            <tr key={inv.id}>
                                <td className="px-4 py-2">{inv.folio}</td>
                                <td className="px-4 py-2">{inv.proveedorNombre || 'N/A'}</td>
                                <td className="px-4 py-2 font-semibold text-gray-900">${(inv.monto || 0).toFixed(2)}</td>
                                <td className="px-4 py-2">{formatDate(inv.fechaPromesaPago)}</td>
                                <td className="px-4 py-2">{getInvoiceStatusBadge(inv.estado)}</td>
                                <td className="px-4 py-2">{getProjectBillingStatusBadge(inv.projectBillingStatus)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                        <tr>
                            <td className="px-4 py-3 font-bold text-right">Total:</td>
                            <td className="px-4 py-3 font-bold text-lg text-gray-900" colSpan="4">${totalSum.toFixed(2)}</td>
                        </tr>
                    </tfoot>
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

// Componente para la grafica de montos entregados por tecnico mensual
const TechnicianRevenueChart = ({ chartData }) => {
    const data = {
        labels: chartData.labels,
        datasets: chartData.datasets,
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            title: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return '$' + new Intl.NumberFormat('es-MX').format(value);
                    }
                }
            }
        }
    };

    return <Line data={data} options={options} />;
};

// El dashboard Directivo Muestra las gráficas y KPIs sobre la salud del negocio que construimos.
const DirectivoDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboardData, setDashboardData] = useState(null);
    const [view, setView] = useState('kpis');
    const [billingMonthViewOffset, setBillingMonthViewOffset] = useState(0);
    const [paidMonthViewOffset, setPaidMonthViewOffset] = useState(0);

    /**
     * @param {Array} projects
     * @param {Array} invoices
     * @param {Array} technicians
     * @param {string} sortBy
     * @param {string} sortOrder
     * @returns {Object}
     */
    const processDataForDashboard = (projects, invoices, technicians) => {
        const currentYear = new Date().getFullYear();
        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneDay = 1000 * 60 * 60 * 24;
        const monthlyProjectsData = Array(12).fill(0).map(() => ({ cotizacion: 0, activo: 0, pendienteFactura: 0, total: 0 }));
        const monthlyARData = Array(12).fill(0).map(() => ({ totalFacturado: 0, pdteProgramacion: 0, programado: 0, venceHoy: 0, vencido: 0, pagado: 0 }));
        const monthlyPaidData = Array(12).fill(0);
        const monthlyProgrammedData = Array(12).fill(0);
        const weeklyCashFlowData = Array(8).fill(0).map(() => ({ ingresos: 0, egresos: 0 }));
        const allAccountsReceivable = [];
        const allAccountsPayable = [];
        const projectsMap = new Map(projects.map(p => [p.id, p]));
        const techniciansMap = {};
        technicians.forEach(t => { techniciansMap[t.id] = t.nombreCompleto; });
        const techRevenueData = {};
        technicians.forEach(t => { techRevenueData[t.id] = { label: t.nombreCompleto.split(' ')[0], data: Array(12).fill(0) }; });

        let totalDeliveryDays = 0, completedProjects = 0;
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

            const deliveryDate = p.fase2_fechaFinTecnico?.toDate() || p.fase1_fechaFinTecnico?.toDate();
            if (deliveryDate && deliveryDate.getFullYear() === currentYear && p.asignadoTecnicosIds && p.asignadoTecnicosIds.length > 0) {
                const month = deliveryDate.getMonth();
                const amount = p.precioCotizacionCliente || 0;
                const responsibleTechId = p.asignadoTecnicosIds[0];
                if (techRevenueData[responsibleTechId]) {
                    techRevenueData[responsibleTechId].data[month] += amount;
                }
            }

            if ((p.precioCotizacionCliente || 0) > 0 && (p.costoProveedor || 0) >= 0) {
                return (p.precioCotizacionCliente - p.costoProveedor) / p.precioCotizacionCliente;
            }
            if (p.fechaAsignacionTecnico?.toDate && (p.fase1_fechaFinTecnico?.toDate() || p.fechaFinTecnicoReal?.toDate())) {
                const finDate = p.fase1_fechaFinTecnico?.toDate() || p.fechaFinTecnicoReal?.toDate();
                totalDeliveryDays += (finDate - p.fechaAsignacionTecnico.toDate()) / oneDay;
                completedProjects++;
            }
        });

        invoices.forEach(inv => {
            const invoiceValue = inv.monto || 0;
            
            let calculatedStatus = 'Pend. de Autorización';
            let promiseDate = null;
            if (inv.estado === 'Pagada') { calculatedStatus = 'Pagada'; }
            else if (inv.estado === 'Cancelada') { calculatedStatus = 'Cancelada'; }
            else if (inv.fechaPromesaPago?.toDate) {
                promiseDate = inv.fechaPromesaPago.toDate();
                promiseDate.setHours(0, 0, 0, 0);
                if (promiseDate < today) { calculatedStatus = 'Vencida'; }
                else if (promiseDate.getTime() === today.getTime()) { calculatedStatus = 'Vence Hoy'; }
                else { calculatedStatus = 'Prog. a Pago'; }
            }
            inv.estado = calculatedStatus;


            if (inv.tipo === 'cliente') {

                if (inv.fechaEmision?.toDate && inv.fechaEmision.toDate().getFullYear() === currentYear) {
                    const month = inv.fechaEmision.toDate().getMonth();
                    if (inv.estado !== 'Cancelada') {
                        monthlyARData[month].totalFacturado += invoiceValue;
                    }
                    switch (inv.estado) {
                        case 'Pagada': monthlyARData[month].pagado += invoiceValue; break;
                        case 'Vencida': monthlyARData[month].vencido += invoiceValue; break;
                        case 'Vence Hoy': monthlyARData[month].venceHoy += invoiceValue; break;
                        case 'Prog. a Pago': monthlyARData[month].programado += invoiceValue; break;
                        case 'Pend. de Autorización': monthlyARData[month].pdteProgramacion += invoiceValue; break;
                        default: break;
                    }
                }

                if (inv.estado === 'Pagada' && inv.fechaPagoReal?.toDate) {
                    const paymentDate = inv.fechaPagoReal.toDate();
                    if (paymentDate.getFullYear() === currentYear) {
                        monthlyPaidData[paymentDate.getMonth()] += invoiceValue;
                    }
                }

                if (promiseDate && (inv.estado === 'Prog. a Pago' || inv.estado === 'Vencida' || inv.estado === 'Vence Hoy')) {
                    if (promiseDate.getFullYear() === currentYear) {
                        monthlyProgrammedData[promiseDate.getMonth()] += invoiceValue;
                    }
                }
            }

            let weekIndex = -1;
            
            if (inv.estado === 'Vencida') {
                weekIndex = 0;
            } else if (inv.estado === 'Prog. a Pago' || inv.estado === 'Vence Hoy') {
                const diffDays = Math.floor((promiseDate - today) / oneDay);
                const calculatedIndex = Math.floor(diffDays / 7);
                if (calculatedIndex >= 0 && calculatedIndex < 8) {
                    weekIndex = calculatedIndex;
                }
            }

            if (weekIndex >= 0) {
                if (inv.tipo === 'cliente') {
                    weeklyCashFlowData[weekIndex].ingresos += invoiceValue;
                } else {
                    weeklyCashFlowData[weekIndex].egresos += invoiceValue;
                }
            }
            
            const project = (inv.proyectoId && inv.proyectoId !== 'general') ? projectsMap.get(inv.proyectoId) : null;
            const processedInv = {
                ...inv,
                planta: project?.ubicacionCliente || project?.clienteNombre || inv.clienteNombre || inv.proveedorNombre || 'N/A',
                servicio: project?.servicioNombre || inv.descripcion || 'Gasto General',
            };
            if (inv.tipo === 'cliente') allAccountsReceivable.push(processedInv);
            if (inv.tipo === 'proveedor') allAccountsPayable.push(processedInv);
        });

        const kpis = {
            avgDeliveryDays: completedProjects > 0 ? (totalDeliveryDays / completedProjects).toFixed(1) : 0,
            monthlyBillingData: monthlyARData,
            monthlyPaidData: monthlyPaidData,
            monthlyProgrammedData: monthlyProgrammedData
        };

        const weeklyLabels = [];
        for (let i = 0; i < 8; i++) {
            const weekStartDate = new Date(today.getTime() + (i * 7 * oneDay));
            weeklyLabels.push(`Sem ${i + 1} (${weekStartDate.getDate()}/${weekStartDate.getMonth() + 1})`);
        }

        const colors = ['rgba(54, 162, 235, 1)', 'rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 206, 86, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'];
        const techDatasets = Object.values(techRevenueData).map((tech, index) => ({
            ...tech,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('1)', '0.2)'),
            fill: true, tension: 0.1,
        }));
        
        const allOperationalProjects = projects.map(p => {
            const responsableId = p.asignadoTecnicosIds?.[0];
            let deliveryStatus = p.estado;
            let sortOrderValue = 99;
            if (p.estado === 'Activo') {
                if (p.fechaFinTecnicoReal) {
                    deliveryStatus = 'En Espera de Proveedor'; sortOrderValue = 4;
                } else {
                    const dueDate = p.fechaEntregaInterna?.toDate();
                    if (!dueDate) {
                        deliveryStatus = 'Sin Fecha'; sortOrderValue = 5;
                    } else {
                        dueDate.setHours(0, 0, 0, 0);
                        const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);
                        if (diffDays < 0) { deliveryStatus = 'Atrasado'; sortOrderValue = 1; }
                        else if (diffDays <= 3) { deliveryStatus = 'Por Vencer'; sortOrderValue = 2; }
                        else { deliveryStatus = 'A Tiempo'; sortOrderValue = 3; }
                    }
                }
            }
            return {
                ...p,
                responsableNombre: techniciansMap[responsableId] || 'No Asignado',
                notaEntregaNumero: p.fase2_numeroNotaInterna || p.fase1_numeroNotaInterna || 'N/A',
                fechaEntregaReal: p.fase1_fechaFinTecnico || p.fase2_fechaFinTecnico || p.fechaFinTecnicoReal,
                deliveryStatus: deliveryStatus,
                sortOrder: sortOrderValue,
            };
        });

        const accountsReceivableList = allAccountsReceivable
            .filter(inv => inv.estado !== 'Pagada' && inv.estado !== 'Cancelada')
            .sort((a, b) => (a.fechaPromesaPago?.toDate() || new Date('2999-12-31')) - (b.fechaPromesaPago?.toDate() || new Date('2999-12-31')));
        
        const accountsPayableList = allAccountsPayable
            .filter(inv => inv.estado !== 'Pagada' && inv.estado !== 'Cancelada')
            .sort((a, b) => (a.fechaPromesaPago?.toDate() || new Date('2999-12-31')) - (b.fechaPromesaPago?.toDate() || new Date('2999-12-31')));
        return {
            kpis,
            pipeline: { labels, cotizacionData: monthlyProjectsData.map(m => m.cotizacion), activoData: monthlyProjectsData.map(m => m.activo), pendienteFacturaData: monthlyProjectsData.map(m => m.pendienteFactura), totalData: monthlyProjectsData.map(m => m.total) },
            accountsReceivable: { labels, totalFacturadoData: monthlyARData.map(m => m.totalFacturado), pagadoData: monthlyARData.map(m => m.pagado), programadoData: monthlyARData.map(m => m.programado), venceHoyData: monthlyARData.map(m => m.venceHoy), vencidoData: monthlyARData.map(m => m.vencido), pdteProgramacionData: monthlyARData.map(m => m.pdteProgramacion) },
            cashFlow: { labels: weeklyLabels, ingresosData: weeklyCashFlowData.map(w => w.ingresos), egresosData: weeklyCashFlowData.map(w => w.egresos) },
            techRevenueChart: { labels, datasets: techDatasets },
            allOperationalProjects,
            techniciansMap,
            accountsReceivableList,
            accountsPayableList,
            projectsMap
        };
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const projectsQuery = query(collection(db, PROYECTOS_COLLECTION));
                const invoicesQuery = query(collection(db, "facturas"));
                const techniciansQueryOld = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
                const techniciansQueryNew = query(collection(db, "usuarios"), where("roles", "array-contains", "tecnico"));

                const [projectsSnapshot, invoicesSnapshot, techniciansOldSnapshot, techniciansNewSnapshot] = await Promise.all([
                    getDocs(projectsQuery),
                    getDocs(invoicesQuery),
                    getDocs(techniciansQueryOld),
                    getDocs(techniciansQueryNew)
                ]);

                const allProjects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const allInvoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const techMap = new Map();
                techniciansOldSnapshot.forEach(doc => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
                techniciansNewSnapshot.forEach(doc => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
                const allTechnicians = Array.from(techMap.values());

                const processedData = processDataForDashboard(allProjects, allInvoices, allTechnicians, );
                setDashboardData(processedData);

            } catch (err) {
                console.error("Error al obtener datos para el dashboard directivo:", err);
                setError("No se pudieron cargar las métricas.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div className="text-center py-10">Calculando métricas... ⚙️</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-600">{error}</div>;
    }

    const getInvoiceStatusBadge = (status) => {
        const styles = {
            'Pagada': 'bg-green-100 text-green-800',
            'Vencida': 'bg-red-100 text-red-800',
            'Prog. a Pago': 'bg-blue-100 text-blue-800',
            'Pend. de Autorización': 'bg-yellow-100 text-yellow-800',
            'Cancelada': 'bg-gray-100 text-gray-700',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Directivos</h1>
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
                    <button onClick={() => setView('cobrar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'cobrar' ? 'border-blue-500' : 'border-transparent text-gray-500'}`}>Cuentas por Cobrar</button>
                    <button onClick={() => setView('pagar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'pagar' ? 'border-blue-500' : 'border-transparent text-gray-500'}`}>Cuentas por Pagar</button>
                </nav>
            </div>

            {view === 'kpis' && (
                <>
                    {dashboardData?.kpis && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <KPIWidget title="Tiempo Prom. Entrega" value={dashboardData.kpis.avgDeliveryDays} unit="días" />
                            {/*Widget de programado a pago del mes corriente */}
                            {(() => {
                                const currentMonthIndex = new Date().getMonth();
                                const kpiValue = dashboardData.kpis.monthlyProgrammedData[currentMonthIndex];
                                const kpiLabel = monthNames[currentMonthIndex];

                                return (
                                    <div className="bg-white p-5 rounded-xl shadow-md">
                                        <h3 className="font-bold text-gray-500">Programado ({kpiLabel})</h3>
                                        <p className="text-3xl font-bold mt-2">
                                            {kpiValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </p>
                                    </div>
                                );
                            })()}
                            {/* Widget de pagado en el mes y los dos anteriores */}
                            {(() => {
                                const currentMonthIndex = new Date().getMonth();
                                const allPaidData = dashboardData.kpis.monthlyPaidData;
                                const monthIndexToShow = (currentMonthIndex - paidMonthViewOffset + 12) % 12;
                                const kpiValue = allPaidData[monthIndexToShow];
                                const kpiLabel = monthNames[monthIndexToShow];

                                return (
                                    <div className="bg-white p-5 rounded-xl shadow-md relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-gray-500">Ingresos ({kpiLabel})</h3>
                                            <div className="flex space-x-1">
                                                <button onClick={() => setPaidMonthViewOffset(prev => (prev + 1) % 3)} /* ... */ >&#8592;</button>
                                                <button onClick={() => setPaidMonthViewOffset(prev => (prev - 1 + 3) % 3)} /* ... */ >&#8594;</button>
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold mt-2">
                                            {kpiValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </p>
                                    </div>
                                );
                            })()}
                            {/* Widget de facturado en el mes y los dos anteriores */}
                            {(() => {
                                const currentMonthIndex = new Date().getMonth();
                                const allBillingData = dashboardData.kpis.monthlyBillingData;
                                const monthIndexToShow = (currentMonthIndex - billingMonthViewOffset + 12) % 12;
                                const kpiValue = allBillingData[monthIndexToShow].totalFacturado;
                                const kpiLabel = monthNames[monthIndexToShow];

                                return (
                                    <div className="bg-white p-5 rounded-xl shadow-md relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-gray-500">Facturado ({kpiLabel})</h3>
                                            <div className="flex space-x-1">
                                                <button 
                                                    onClick={() => setBillingMonthViewOffset(prev => (prev + 1) % 3)} 
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center"
                                                    title="Mes anterior"
                                                >
                                                    &#8592;
                                                </button>
                                                <button 
                                                    onClick={() => setBillingMonthViewOffset(prev => (prev - 1 + 3) % 3)} 
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center"
                                                    title="Mes siguiente"
                                                >
                                                    &#8594;
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold mt-2">
                                            {kpiValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </p>
                                    </div>
                                );
                            })()}
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
                            <h3 className="font-bold text-lg mb-4">Monto Entregado por Técnico (Mensual)</h3>
                            <div className="h-80">
                                {dashboardData?.techRevenueChart && <TechnicianRevenueChart chartData={dashboardData.techRevenueChart} />}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {view === 'operativo' && dashboardData && (
                <OperationalReportTable
                    projects={dashboardData.allOperationalProjects}
                    techniciansMap={dashboardData.techniciansMap}
                />
            )}

            {view === 'cobrar' && dashboardData && (
                <FinancialTrackingTable
                    title="Cuentas por Cobrar"
                    invoices={dashboardData.accountsReceivableList}
                    getInvoiceStatusBadge={getInvoiceStatusBadge}
                />
            )}
            {view === 'pagar' && dashboardData && (
                <AccountsPayableDirectiveTable
                    invoices={dashboardData.accountsPayableList}
                    projectsMap={dashboardData.projectsMap}
                />
            )}
        </div>
    );
};

//panel para el manejo de la informacion de los proyectos de ecotech
const EcotechDashboard = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = () => {
        setLoading(true);
        const q = query(
            collection(db, PROYECTOS_COLLECTION),
            where("proveedorNombre", "==", "Ecotech Ingenieria del Medio Ambiente"),
            where("estado", "==", "Activo")
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projects for Ecotech: ", error);
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
        
        if (project.datosEcotech?.estatus === 'Terminado') {
            return { text: 'Terminado', class: 'bg-blue-100 text-blue-800' };
        }

        if (project.datosEcotech?.fechaEnvioDigital?.toDate) {
            const deadlineLab = addBusinessDays(project.datosEcotech?.fechaEnvioDigital.toDate(), 15);
            if (today > deadlineLab) {
                return { text: 'Vencido Lab.', class: 'bg-red-100 text-red-800 font-bold' };
            }
            return { text: project.datosEcotech?.estatus, class: 'bg-green-100 text-green-800' };
        }

        if (project.datosEcotech?.fechaMuestreo?.toDate) {
            const deadlineInternal = addBusinessDays(project.datosEcotech?.fechaMuestreo.toDate(), 3);
            if (today > deadlineInternal) {
                return { text: 'Vencido Internamente', class: 'bg-orange-100 text-orange-800 font-semibold' };
            }
            return { text: project.datosEcotech?.estatus, class: 'bg-green-100 text-green-800' };
        }

        return { text: project.datosEcotech?.estatus || 'Pendiente', class: 'bg-gray-100 text-gray-700' };
    };

    const ManageEcotechProjectModal = ({ project, onClose, onFinalized }) => {
        const [labProjectNumber, setLabProjectNumber] = useState(project.datosEcotech?.numeroProyecto || '');
        const [workPoints, setWorkPoints] = useState(project.datosEcotech?.puntosDeTrabajo || '');
        const [notes, setNotes] = useState(project.datosEcotech?.notas || '');
        const [guiaEnvio, setGuiaEnvio] = useState(project.datosEcotech?.numeroGuiaEnvio || '');
        const [guiaRegreso, setGuiaRegreso] = useState(project.datosEcotech?.numeroGuiaRegreso || '');
        const [fechaMuestreo, setFechaMuestreo] = useState(project.datosEcotech?.fechaMuestreo || '');
        const [loading, setLoading] = useState(false);
        
        const handleUpdateStatus = async (updateData) => {
            setLoading(true);
            const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
            try {
                await updateDoc(projectRef, updateData);
                onFinalized();
                onClose();
            } catch (err) {
                alert("Error al actualizar el estado.");
                setLoading(false);
            }
        };

        const handleSaveChanges = async () => {
            setLoading(true);
            const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
            try {
                await updateDoc(projectRef, {
                    "datosEcotech.numeroProyecto": labProjectNumber,
                    "datosEcotech.puntosDeTrabajo": Number(workPoints) || 0,
                    "datosEcotech.notas": notes,
                    "datosEcotech.numeroGuiaEnvio": guiaEnvio,
                    "datosEcotech.numeroGuiaRegreso": guiaRegreso,
                });
                onFinalized();
            } catch (err) { alert("No se pudieron guardar los cambios."); }
            finally { setLoading(false); }
        };

        const handleStart = () => handleUpdateStatus({ "datosEcotech.estatus": 'Pend. No de proyecto' });
        const handleSaveSamplingDate = () => handleUpdateStatus({ "datosEcotech.estatus": 'En Proceso', "datosEcotech.fechaMuestreo": Timestamp.fromDate(new Date(fechaMuestreo)) });
        const handleSendDigital = () => handleUpdateStatus({ "datosEcotech.estatus": 'Enviado Dig.', "datosEcotech.fechaEnvioDigital": Timestamp.now() });
        const handleSendPhysical = () => handleUpdateStatus({ "datosEcotech.estatus": 'Enviado Físicamente', "datosEcotech.numeroGuiaEnvio": guiaEnvio });
        const handleFinishProject = () => handleUpdateStatus({ "datosEcotech.estatus": 'Terminado', "datosEcotech.numeroGuiaRegreso": guiaRegreso });

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                    <h3 className="text-lg font-bold mb-2">Gestionar Proyecto Ecotech: {project.npu}</h3>
                    <p className="text-sm text-gray-500 mb-6">Estado actual: <span className="font-bold">{project.datosEcotech?.estatus || 'Pendiente'}</span></p>
                    
                    <div className="space-y-4 mb-6">
                        {project.datosEcotech?.estatus === 'Pendiente' && (
                            <button onClick={handleStart} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Empezar Tarea</button>
                        )}
                        {project.datosEcotech?.estatus === 'Pend. No de proyecto' && (
                            <div className="p-4 border rounded-md bg-gray-50">
                                <label className="block text-sm font-medium">Introduce la Fecha de Muestreo</label>
                                <input type="date" value={fechaMuestreo} onChange={e => setFechaMuestreo(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                                <button onClick={handleSaveSamplingDate} disabled={!fechaMuestreo} className="w-full mt-3 bg-blue-600 text-white font-bold py-2 rounded-lg disabled:bg-gray-400">Guardar Fecha y Poner "En Proceso"</button>
                            </div>
                        )}
                        {project.datosEcotech?.estatus === 'En Proceso' && (
                            <button onClick={handleSendDigital} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Marcar como "Enviado Digitalmente"</button>
                        )}
                        {project.datosEcotech?.estatus === 'Enviado Dig.' && (
                            <div className="p-4 border rounded-md bg-gray-50">
                                <label className="block text-sm font-medium">Introduce la Guía de Envío Físico</label>
                                <input type="text" value={guiaEnvio} onChange={e => setGuiaEnvio(e.target.value)} placeholder="Número de guía..." className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                                <button onClick={handleSendPhysical} disabled={!guiaEnvio} className="w-full mt-3 bg-blue-600 text-white font-bold py-2 rounded-lg disabled:bg-gray-400">Marcar como "Enviado Físicamente"</button>
                            </div>
                        )}
                        {project.datosEcotech?.estatus === 'Enviado Físicamente' && (
                            <div className="p-4 border rounded-md bg-gray-50">
                                <label className="block text-sm font-medium">Introduce la Guía de Regreso para Finalizar</label>
                                <input type="text" value={guiaRegreso} onChange={e => setGuiaRegreso(e.target.value)} placeholder="Número de guía..." className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                                <button onClick={handleFinishProject} disabled={!guiaRegreso} className="w-full mt-3 bg-green-600 text-white font-bold py-2 rounded-lg disabled:bg-gray-400">Finalizar Proyecto</button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 border-t pt-6">
                        <h4 className="text-md font-semibold text-gray-800">Información Adicional</h4>
                        <div>
                            <label className="block text-sm font-medium">Número de Proyecto (Laboratorio)</label>
                            <input type="text" value={labProjectNumber} onChange={e => setLabProjectNumber(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Puntos de Trabajo</label>
                            <input type="number" value={workPoints} onChange={e => setWorkPoints(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Notas</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border rounded-md"></textarea>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cerrar</button>
                        <button onClick={handleSaveChanges} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.datosEcotech?.numeroProyecto || '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.datosEcotech?.puntosDeTrabajo || '---'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500" title={project.datosEcotech?.notas}>
                                        <p className="w-40 truncate">{project.datosEcotech?.notas || '---'}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.datosEcotech?.numeroGuiaEnvio || '---'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{project.datosEcotech?.numeroGuiaRegreso || '---'}</td>
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

//para las tarjetas de salud de los tecnicos que se visualizan en el panel del supervisor
const TechnicianHealthCard = ({ techData }) => {
    const {
        nombre,
        proyectosActivos,
        proyectosEntregados,
        horasAsignadas,
        capacidadSemanal,
        saturacion,
        diasParaTerminar,
        rendimiento,
    } = techData;

    const getSaturationColor = (percentage) => {
        if (percentage > 100) return 'bg-red-500';
        if (percentage > 85) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getPerformanceColor = (percentage) => {
        if (percentage < 80) return 'text-red-600';
        if (percentage < 100) return 'text-orange-500';
        return 'text-green-600';
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col space-y-4">
            <h3 className="text-xl font-bold text-gray-800 truncate">{nombre}</h3>
            
            <div>
                <div className="flex justify-between text-sm font-medium text-gray-600">
                    <span>Saturación (Horas Semanales)</span>
                    <span>{horasAsignadas.toFixed(1)}h / {capacidadSemanal}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mt-1">
                    <div
                        className={`h-4 rounded-full ${getSaturationColor(saturacion)}`}
                        style={{ width: `${Math.min(saturacion, 100)}%` }}
                    ></div>
                </div>
                 {saturacion > 100 && <p className="text-xs text-red-600 font-semibold mt-1">¡Sobrecargado por {(saturacion - 100).toFixed(0)}%!</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 text-center border-t border-b py-4">
                <div>
                    <p className="text-2xl font-bold">{proyectosActivos}</p>
                    <p className="text-sm text-gray-500">Proyectos Activos</p>
                </div>
                <div>
                    <p className="text-2xl font-bold">{proyectosEntregados}</p>
                    <p className="text-sm text-gray-500">Entregados (2025)</p>
                </div>
                <div>
                    <p className="text-2xl font-bold">{diasParaTerminar.toFixed(1)}</p>
                    <p className="text-sm text-gray-500">Días para Terminar</p>
                </div>
                <div>
                    <p className={`text-2xl font-bold ${getPerformanceColor(rendimiento)}`}>{rendimiento.toFixed(0)}%</p>
                    <p className="text-sm text-gray-500">Rendimiento (Est. vs Real)</p>
                </div>
            </div>

        </div>
    );
};

// El dashboard del Supervisor. Aquí ve los proyectos nuevos para asignar
// y monitorea el progreso de los que ya están en proceso.
const SupervisorDashboard = ({ user, userData, selectedRole }) => {
    const [view, setView] = useState('new');
    const [allProjects, setAllProjects] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [reviewProjects, setReviewProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalProject, setModalProject] = useState(null);
    const [assignModalProject, setAssignModalProject] = useState(null);

    const fetchData = async () => {
        try {
            const qProjects = query(collection(db, PROYECTOS_COLLECTION), where("estado", "!=", "Cotización"));
            const qTechsOld = query(collection(db, "usuarios"), where("rol", "==", "tecnico"));
            const qTechsNew = query(collection(db, "usuarios"), where("roles", "array-contains", "tecnico"));
            const qReview = query(collection(db, PROYECTOS_COLLECTION), where("estado", "==", "En Revisión Final"));

            const [projectsSnapshot, techsOldSnapshot, techsNewSnapshot, reviewSnapshot] = await Promise.all([
                getDocs(qProjects),
                getDocs(qTechsOld),
                getDocs(qTechsNew),
                getDocs(qReview),
            ]);

            const projectsData = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const techMap = new Map();
            techsOldSnapshot.forEach(doc => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
            techsNewSnapshot.forEach(doc => techMap.set(doc.id, { id: doc.id, ...doc.data() }));
            
            setAllProjects(projectsData);
            setTechnicians(Array.from(techMap.values()));
            setReviewProjects(reviewSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (err) {
            console.error("Error fetching supervisor data:", err);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    useEffect(() => {
        if (view !== 'review') {
            setReviewProjects([]);
            return;
        }

        const q = query(collection(db, PROYECTOS_COLLECTION), where("estado", "==", "En Revisión Final"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReviewProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [view]);

    const processedData = React.useMemo(() => {
        if (technicians.length === 0) return { healthData: [], newProjects: [], projectsByTechnician: {} };

        const healthData = technicians.map(tech => {
            const assignedProjects = allProjects.filter(p => p.asignadoTecnicosIds?.includes(tech.id));
            
            const activeProjects = assignedProjects.filter(p => p.estado === 'Activo' && !p.fechaFinTecnicoReal);
            
            const horasAsignadas = activeProjects.reduce((sum, p) => {
                const remainingHours = Math.max(0, (p.horasEstimadas || 0) - (p.horasRegistradas || 0));
                return sum + remainingHours;
            }, 0);

            const capacidadSemanal = (tech.horasDisponiblesDiarias || 8) * 5;
            const saturacion = capacidadSemanal > 0 ? (horasAsignadas / capacidadSemanal) * 100 : 0;
            const diasParaTerminar = (tech.horasDisponiblesDiarias || 8) > 0 ? horasAsignadas / (tech.horasDisponiblesDiarias || 8) : 0;

            const deliveredInYear = allProjects.filter(p => 
                p.asignadoTecnicosIds?.includes(tech.id) &&
                (p.estado === 'Archivado' || p.estado === 'Facturado') &&
                (p.fase1_fechaFinTecnico || p.fechaFinTecnicoReal)?.toDate().getFullYear() === new Date().getFullYear()
            ).length;

            const completedProjectsWithMetrics = allProjects.filter(p =>
                p.asignadoTecnicosIds?.includes(tech.id) &&
                p.horasEstimadas > 0 &&
                p.horasRegistradas > 0 &&
                p.fechaFinTecnicoReal
            );

            let rendimiento = 100;
            if (completedProjectsWithMetrics.length > 0) {
                const totalRatio = completedProjectsWithMetrics.reduce((sum, p) => sum + (p.horasEstimadas / p.horasRegistradas), 0);
                rendimiento = (totalRatio / completedProjectsWithMetrics.length) * 100;
            }

            return {
                id: tech.id,
                nombre: tech.nombreCompleto,
                proyectosActivos: activeProjects.length,
                proyectosEntregados: deliveredInYear,
                horasAsignadas,
                capacidadSemanal,
                saturacion,
                diasParaTerminar,
                rendimiento,
            };
        });

        const newProjects = allProjects.filter(p => p.estado === 'Activo' && (!p.asignadoTecnicosIds || p.asignadoTecnicosIds.length === 0));

        const projectsByTechnician = {};
        technicians.forEach(tech => {
            projectsByTechnician[tech.id] = allProjects.filter(p =>
                p.estado === 'Activo' && p.asignadoTecnicosIds?.includes(tech.id)
            );
            projectsByTechnician[tech.id].sort((a, b) => (b.prioridad || "").localeCompare(a.prioridad || ""));
        });

        const projectsForReview = allProjects.filter(p => p.estado === 'En Revisión Final');

        return { healthData, newProjects, projectsByTechnician, projectsForReview };
    }, [allProjects, technicians]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Panel de Supervisión</h1>
            {loading ? <p>Calculando métricas...</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,3fr] gap-8">
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Vistas de Gestión</h2>
                        <button onClick={() => setView('new')} className={`w-full p-3 rounded-lg text-left transition-colors ${view === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold">Nuevos por Asignar</span>
                                {processedData.newProjects.length > 0 && <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{processedData.newProjects.length}</span>}
                            </div>
                        </button>
                        <button onClick={() => setView('review')} className={`w-full p-3 rounded-lg text-left transition-colors ${view === 'review' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>
                             <div className="flex justify-between items-center">
                                <span className="font-bold">Revisión Final</span>
                                {reviewProjects.length > 0 && <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{reviewProjects.length}</span>}
                            </div>
                        </button>
                        <hr className="my-4"/>
                        <h2 className="text-lg font-semibold text-gray-700">Equipo Técnico</h2>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                            {processedData.healthData.map(tech => (
                                <button key={tech.id} onClick={() => setView(tech.id)} className={`w-full text-left transition-colors ${view === tech.id ? 'ring-2 ring-blue-500' : ''}`}>
                                    <TechnicianHealthCard techData={tech} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="min-w-0">
                        {view === 'new' && <ProjectsTable projects={processedData.newProjects} userRole="supervisor" supervisorView="new" onAssignClick={setAssignModalProject} user={user} userData={userData} selectedRole={selectedRole}/>}
                        {view === 'review' && <ReviewProjectsTable projects={reviewProjects} onUpdateProject={fetchData} />}

                        {processedData.projectsByTechnician[view] && (
                            <ProjectsTable projects={processedData.projectsByTechnician[view]} userRole="supervisor" supervisorView="techDetail" onManageClick={setModalProject} onAssignClick={setAssignModalProject} user={user} userData={userData} selectedRole={selectedRole} />
                        )}
                    </div>
                </div>
            )}

            {modalProject && <ProjectManagementModal project={modalProject} onClose={() => setModalProject(null)} onUpdate={fetchData} {...{user, userData, userRole:"supervisor"}} />}
            {assignModalProject && <AssignProjectModal project={assignModalProject} onClose={() => setAssignModalProject(null)} onFinalized={fetchData} />}
        </div>
    );
};

// El dashboard del Técnico. Su lista de tareas pendientes y en proceso.
// Desde aquí empieza a trabajar, usa la bitácora y finaliza sus tareas.
const TecnicoDashboard = ({ user, userData, selectedRole, setIsWorkingState }) => {
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    const [activeTaskInfo, setActiveTaskInfo] = useState(null);
    const [isOnBreak, setIsOnBreak] = useState(null);    
    const [loadingTask, setLoadingTask] = useState(true);

    const [modalProject, setModalProject] = useState(null);
    const [modalType, setModalType] = useState('');
    const [confirmingAction, setConfirmingAction] = useState(null);
    const [showNewProjectsAlert, setShowNewProjectsAlert] = useState(true);

    const isSameDay = (date1, date2) => {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    };

    const breakTakenToday = isSameDay(userData?.ultimoDescanso?.toDate(), new Date());

    const handleStartWork = React.useCallback(async (projectId) => {
        const userDocRef = doc(db, "usuarios", user.uid);
        const newActiveTask = { projectId: projectId, inicio: Timestamp.now() };

        if (activeTaskInfo && activeTaskInfo.projectId) {
            const timeLogRef = doc(collection(db, "registrosDeTiempo"));
            await setDoc(timeLogRef, {
                tecnicoId: user.uid,
                projectId: activeTaskInfo.projectId,
                fechaInicio: activeTaskInfo.inicio,
                fechaFin: Timestamp.now(),
            });
        }
        
        const projectRef = doc(db, PROYECTOS_COLLECTION, projectId);
        await updateDoc(projectRef, { [`tecnicosStatus.${user.uid}`]: "En Proceso" });
        await updateDoc(userDocRef, { tareaActiva: newActiveTask });
    }, [user, activeTaskInfo]);

    const handlePauseWork = React.useCallback(async () => {
        if (!activeTaskInfo) return;
        const userDocRef = doc(db, "usuarios", user.uid);
        const timeLogRef = doc(collection(db, "registrosDeTiempo"));
        
        await setDoc(timeLogRef, {
            tecnicoId: user.uid,
            projectId: activeTaskInfo.projectId,
            fechaInicio: activeTaskInfo.inicio,
            fechaFin: Timestamp.now(),
        });

        await updateDoc(userDocRef, { tareaActiva: deleteField() });
    }, [user, activeTaskInfo]);

    const handleEndDay = React.useCallback(async () => {
        if (activeTaskInfo) {
            await handlePauseWork();
        }
        toast.info("Tu jornada finalizo el cronómetro se ha detenido.");
    }, [activeTaskInfo, handlePauseWork]);

    const handleStartBreak = React.useCallback(async () => {
        if (!activeTaskInfo) return;
        await handlePauseWork();
        const userDocRef = doc(db, "usuarios", user.uid);
        await updateDoc(userDocRef, {
            enDescanso: {
                inicio: Timestamp.now(),
                proyectoPausadoId: activeTaskInfo.projectId,
            },
            ultimoDescanso: Timestamp.now(),
        });
    }, [activeTaskInfo, handlePauseWork, user.uid]);

   const handleEndBreak = React.useCallback(async () => {
        if (!isOnBreak || !user?.uid) return;
        const userDocRef = doc(db, "usuarios", user.uid);
        await handleStartWork(isOnBreak.proyectoPausadoId);
        await updateDoc(userDocRef, {
            enDescanso: deleteField(),
        });
    }, [isOnBreak, handleStartWork, user]);
/*
    useEffect(() => {
        setLoadingTask(true);
        setIsWorkingState(false); // Estado inicial por defecto

        const taskData = userData?.tareaActiva;
        const breakData = userData?.enDescanso;

        setIsOnBreak(breakData || null);

        if (taskData && taskData.projectId) {
            // Si hay tarea, buscamos los detalles del proyecto (una sola vez)
            const projDocRef = doc(db, PROYECTOS_COLLECTION, taskData.projectId);
            getDoc(projDocRef).then(projDoc => {
                setActiveTaskInfo({
                    ...taskData,
                    projectId: projDoc.id,
                    projectDetails: projDoc.exists() ? { id: projDoc.id, ...projDoc.data() } : null,
                });
                setIsWorkingState(true); // Está trabajando
                setLoadingTask(false);
            }).catch(err => {
                console.error("Error fetching active project:", err);
                setLoadingTask(false);
                setIsWorkingState(false);
            });
        } else {
            setActiveTaskInfo(null);
            // Si está en descanso, no está "trabajando activamente"
            setIsWorkingState(!!breakData); 
            setLoadingTask(false);
        }
    }, [userData, setIsWorkingState]);
*/


    useEffect(() => {
        if (!user?.uid) {
            setLoadingTask(false);
            setActiveTaskInfo(null);
            setIsOnBreak(null);
            setIsWorkingState(false);
            return;
        }

        setLoadingTask(true);
        const userDocRef = doc(db, "usuarios", user.uid);
        
        const unsubscribeUser = onSnapshot(userDocRef, async (userDoc) => {
            const data = userDoc.data();
            const taskData = data?.tareaActiva;
            const breakData = data?.enDescanso;
            
            setIsOnBreak(breakData || null);

            if (taskData && taskData.projectId) {
                try {
                    const projDocRef = doc(db, PROYECTOS_COLLECTION, taskData.projectId);
                    const projDoc = await getDoc(projDocRef);
                    
                    setActiveTaskInfo({
                        ...taskData,
                        projectId: projDoc.id,
                        projectDetails: projDoc.exists() ? { id: projDoc.id, ...projDoc.data() } : null,
                    });
                    setIsWorkingState(true);
                } catch (err) {
                    console.error("Error fetching active project details:", err);
                    setActiveTaskInfo(null);
                    setIsWorkingState(false);
                }
            } else {
                setActiveTaskInfo(null);
                setIsWorkingState(false);
            }
            if (breakData) {
                 setIsWorkingState(false);
            }
            setLoadingTask(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            setLoadingTask(false);
            setActiveTaskInfo(null);
            setIsOnBreak(null);
            setIsWorkingState(false);
        });
        
        return () => unsubscribeUser();
    }, [user, setIsWorkingState]);

    useEffect(() => {
        if (!isOnBreak) return;
        const breakEndTime = isOnBreak.inicio.toMillis() + (75 * 60 * 1000);
        const now = Date.now();
        const timeUntilEnd = breakEndTime - now;

        if (timeUntilEnd <= 0) {
            handleEndBreak();
            return;
        }

        const timerId = setTimeout(handleEndBreak, timeUntilEnd);
        return () => clearTimeout(timerId);
    }, [isOnBreak, handleEndBreak]);

    useEffect(() => {
        if (!user?.uid) {
            setProjects([]);
            setLoadingProjects(false);
            return;
        };
        setLoadingProjects(true);
        const q = query(
            collection(db, PROYECTOS_COLLECTION),
            where("asignadoTecnicosIds", "array-contains", user.uid),
            where("estado", "==", "Activo")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingProjects(false);
        }, (error) => {
            console.error("Error fetching technician projects:", error);
            setProjects([]);
            setLoadingProjects(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSoftFinish = async (projectId) => {
        const projectRef = doc(db, PROYECTOS_COLLECTION, projectId);
        try {
            await updateDoc(projectRef, {
                fechaFinTecnicoReal: Timestamp.now()
            });
            toast.success("Tarea técnica finalizada y registrada.");
        } catch (err) {
            alert("Error al finalizar la tarea técnica.");
        }
        setConfirmingAction(null);
    };
    
    const promptSoftFinish = (projectId) => {
        setConfirmingAction({
            title: "Confirmar Finalización Técnica",
            message: "Esta acción registrará la fecha de hoy como tu fin de tarea, el proyecto seguira activo hasta que generes la nota de entrega. ¿Estás seguro?",
            onConfirm: () => handleSoftFinish(projectId),
            confirmText: "Sí, Finalizar"
        });
    };

    const { newProjectsCount, kanbanProjects } = React.useMemo(() => {
        if (!user?.uid) return { newProjectsCount: 0, kanbanProjects: [] };
        const sorted = projects.sort((a, b) => (b.prioridad || "").localeCompare(a.prioridad || ""));
        const count = projects.filter(p => p.tecnicosStatus?.[user.uid] === "No Visto").length;
        return { newProjectsCount: count, kanbanProjects: sorted };
    }, [projects, user]);

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
                const evidenceRef = ref(storage, `evidencia_tecnicos/${project.id}/${Date.now()}_${evidenceFile.name}`);
                const evidenceUploadTask = uploadBytesResumable(evidenceRef, evidenceFile);
                const evidenceUrl = await getDownloadURL((await evidenceUploadTask).ref);
                const { numeroNota } = await generateAndSaveNota();
                const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
                
                const updatePayload = {
                    estado: 'Terminado Internamente',
                };

                const now = Timestamp.now();

                if (project.fase1_fechaFinTecnico) {
                    updatePayload.fase2_comentariosTecnico = comments;
                    updatePayload.fase2_urlEvidencia = evidenceUrl;
                    updatePayload.fase2_numeroNotaInterna = numeroNota;
                    updatePayload.fase2_fechaFinTecnico = now;
                } else {
                    updatePayload.fase1_comentariosTecnico = comments;
                    updatePayload.fase1_urlEvidencia = evidenceUrl;
                    updatePayload.fase1_numeroNotaInterna = numeroNota;
                    updatePayload.fase1_fechaFinTecnico = now;
                }
                
                if (!project.fechaFinTecnicoReal) {
                    updatePayload.fechaFinTecnicoReal = now;
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
    
    const ProjectCard = ({ project }) => {
        const isWorkingOnThis = activeTaskInfo?.projectId === project.id;
        const buttonText = isWorkingOnThis ? 'Trabajando en este' : activeTaskInfo ? 'Cambiar a este Proyecto' : 'Empezar a Trabajar';
        return (
            <div className={`p-4 bg-white rounded-lg shadow-md border-l-4 transition-all ${isWorkingOnThis ? 'ring-2 ring-blue-500' : ''} ${project.prioridad === '3 - Urgente' ? 'border-red-500' : project.prioridad === '2 - Alta' ? 'border-orange-500' : 'border-gray-300'}`}>
                <p className="font-bold text-gray-800">{project.servicioNombre}</p>
                <p className="text-sm text-gray-600">{project.clienteNombre}</p>
                <p className="text-sm text-gray-400">{project.npu}</p>
                <p className="text-xs text-gray-400 mt-2">Prioridad: <span className="font-semibold">{project.prioridad || 'N/A'}</span></p>
                <button
                    onClick={() => handleStartWork(project.id)}
                    disabled={isWorkingOnThis || isOnBreak}
                    className="w-full mt-4 bg-green-600 text-white font-bold py-2 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-700"
                >
                    {buttonText}
                </button>
            </div>
        );
    };
    
    const ActiveProjectTools = ({ project }) => {
        if (!project) return null;
        const isInternalProvider = project.projectDetails.proveedorNombre?.toLowerCase().includes('ecologia');
        const isSoftFinished = !!project.projectDetails.fechaFinTecnicoReal;
        
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-lg font-bold mb-4">Herramientas para: {project.projectDetails.npu}</h3>
                <div className="space-y-4">
                    <button onClick={() => { setModalProject(project.projectDetails); setModalType('log'); }} className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700">Ver Bitácora</button>

                    {isInternalProvider ? (
                        <button onClick={() => { setModalProject(project.projectDetails); setModalType('task'); }} className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                            Generar Nota de Entrega
                        </button>
                    ) : (
                        <>
                            {!isSoftFinished && (
                                <button onClick={() => promptSoftFinish(project.projectId)} className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                    Finalizar Parte Técnica
                                </button>
                            )}
                            
                            {isSoftFinished && (
                                <>
                                    <p className="text-center p-2 bg-green-100 text-green-800 rounded-md text-sm font-semibold">
                                        Parte Técnica Finalizada (En espera de proveedor)
                                    </p>
                                    <button onClick={() => { setModalProject(project.projectDetails); setModalType('task'); }} className="w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                                        Generar Nota de Entrega Final
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };
    
    const WelcomePanel = () => (
        <div className="text-center p-10 bg-white rounded-lg shadow-lg h-full flex flex-col justify-center">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">¿En qué vas a trabajar hoy?</h2>
            <p className="text-gray-500">Selecciona un proyecto de tu Kanban para empezar trabajar en un proyecto.</p>
        </div>
    );

    const isLoading = loadingProjects || loadingTask;

    return (
        <div>
            {isOnBreak && <BreakBanner breakInfo={isOnBreak} onEndBreak={handleEndBreak} />}
            {activeTaskInfo && !isOnBreak && <ActiveTaskBanner task={activeTaskInfo} onEndDay={handleEndDay} onStartBreak={handleStartBreak} breakTakenToday={breakTakenToday} />}
            
            {newProjectsCount > 0 && showNewProjectsAlert && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md shadow-md relative" role="alert">
                    <button onClick={() => setShowNewProjectsAlert(false)} className="absolute top-2 right-2 text-yellow-700 font-bold text-lg">&times;</button>
                    <p className="font-bold">¡Atención!</p>
                    <p>Tienes {newProjectsCount} proyecto(s) nuevo(s) asignado(s). ¡Revísalos en tu Kanban!</p>
                </div>
            )}
            
            <div className={`grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-8`}>
                
                <div>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Mi Kanban de Tareas</h2>
                    {isLoading ? <p>Cargando...</p> : (
                        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-4 rounded-lg">
                            {kanbanProjects.length > 0 ? (
                                kanbanProjects.map(project => <ProjectCard key={project.id} project={project} />)
                            ) : (
                                <p className="text-gray-500 p-4 bg-white rounded-md">No tienes proyectos activos asignados.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="sticky top-40 h-fit">
                    {!isLoading && (
                        activeTaskInfo ? <ActiveProjectTools project={activeTaskInfo} /> : <WelcomePanel />
                    )}
                </div>
            </div>

            {modalProject && modalType === 'log' && <ProjectLogModal project={modalProject} user={user} userData={userData} onClose={() => setModalProject(null)} selectedRole={selectedRole} />}
            {modalProject && modalType === 'task' && <ManageTaskModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={() => {}} />}
            {confirmingAction && <ConfirmationModal {...confirmingAction} onCancel={() => setConfirmingAction(null)} />}
        </div>
    );
};

const ActiveTaskBanner = ({ task, onEndDay, onStartBreak, breakTakenToday }) => {
    const elapsedTime = useTimer(task.inicio);
    return (
        <div className="bg-blue-600 text-white p-4 rounded-lg shadow-lg mb-8 flex justify-between items-center sticky top-20 z-30">
            <div>
                <p className="font-bold">Trabajando ahora en:</p>
                <p className="text-lg">{task.projectDetails?.npu} - {task.projectDetails?.servicioNombre}</p>
            </div>
            <div className="flex items-center space-x-6">
                <p className="text-2xl font-mono">{elapsedTime}</p>
                <button 
                    onClick={onStartBreak} 
                    disabled={breakTakenToday}
                    className="bg-green-500 hover:bg-green-600 font-bold py-3 px-4 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title={breakTakenToday ? "Ya tomaste tu descanso de hoy" : "Ir a comer"}
                >
                    Ir a Comer
                </button>
                <button onClick={onEndDay} className="bg-red-600 hover:bg-red-700 font-bold py-3 px-4 rounded-lg">
                    Finalizar Día
                </button>
            </div>
        </div>
    );
};
// El dashboard de Finanzas. Gestiona las facturas, cuentas por cobrar y por pagar.
const FinanzasDashboard = ({ user, userData }) => {
    const [view, setView] = useState('dashboard');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPendingProjects = () => {
        setLoading(true);
        const q = query(collection(db, PROYECTOS_COLLECTION), where("estado", "in", ["Pendiente de Factura", "Facturado"]));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            projectsData.forEach(project => {
                if (project.estado === 'Facturado' && project.faseFacturacion === 'Preliminar') {
                    console.log(`[AUTO-REACTIVACIÓN] Proyecto ${project.npu} detectado para Fase 2.`);
                    const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
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
                    <button onClick={() => setView('dashboard')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'dashboard' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        Dashboard
                    </button>
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

            {view === 'dashboard' && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 my-6">Análisis Financiero</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <AgingReport />
                        {/* En el futuro, agregar mas graficas conforme se necesites */}
                    </div>
                </div>
            )}

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

// modal para subir facturas a proyectos pendientes de facturar
const PendingInvoicesTable = ({ projects, onUpdate }) => {
    const [modalProject, setModalProject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const AttachInvoicesModal = ({ project, onClose, onFinalized }) => {
        const [mode, setMode] = useState('upload');
        const [clientXmlFile, setClientXmlFile] = useState(null);
        const [providerXmlFile, setProviderXmlFile] = useState(null);
        const [clientInvoiceData, setClientInvoiceData] = useState(null);
        const [providerInvoiceData, setProviderInvoiceData] = useState(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [linkableInvoices, setLinkableInvoices] = useState([]);
        const [selectedClientInvoiceId, setSelectedClientInvoiceId] = useState('');
        const [selectedProviderInvoiceId, setSelectedProviderInvoiceId] = useState('');

        const isInternalProvider = project.proveedorNombre?.toLowerCase().includes("ecologia");

        useEffect(() => {
            if (mode === 'link') {
                const q = query(collection(db, "facturas"), orderBy("fechaEmision", "desc"));
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    setLinkableInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
                return () => unsubscribe();
            }
        }, [mode]);

        const handleFileChange = (e, type) => {
            const file = e.target.files[0];
            if (!file) return;

            if (type === 'client') setClientXmlFile(file);
            if (type === 'provider') setProviderXmlFile(file);

            const reader = new FileReader();
            reader.onload = (event) => {
                const xmlText = event.target.result;
                const extractedData = parseInvoiceXML(xmlText);

                if (extractedData) {
                    if (type === 'client') setClientInvoiceData(extractedData);
                    if (type === 'provider') setProviderInvoiceData(extractedData);
                    setError('');
                } else {
                    setError('Error al leer el XML. Asegúrate de que es un archivo CFDI válido.');
                }
            };
            reader.readAsText(file);
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
                const projectRef = doc(db, PROYECTOS_COLLECTION, project.id);
                const updatePayload = {};

                if (mode === 'upload') {
                    if (clientXmlFile && clientInvoiceData) {
                        const urlXml = await uploadFile(clientXmlFile, `facturas_clientes/${project.id}/${clientXmlFile.name}`);
                        const newInvoiceRef = await addDoc(collection(db, "facturas"), {
                            tipo: "cliente",
                            proyectoId: project.id,
                            folio: clientInvoiceData.folio,
                            uuid: clientInvoiceData.uuid,
                            subtotal: clientInvoiceData.subtotal,
                            iva: clientInvoiceData.iva,
                            monto: clientInvoiceData.monto,
                            fechaEmision: Timestamp.fromDate(clientInvoiceData.fechaEmision),
                            estado: "Pendiente",
                            urlXml: urlXml,
                            pdfUrl: '',
                            clienteNombre: project.clienteNombre,
                        });
                        updatePayload.facturasClienteIds = arrayUnion(newInvoiceRef.id);
                    }

                    if (!isInternalProvider && providerXmlFile && providerInvoiceData) {
                        const urlXml = await uploadFile(providerXmlFile, `facturas_proveedores/${project.id}/${providerXmlFile.name}`);
                        const newInvoiceRef = await addDoc(collection(db, "facturas"), {
                            tipo: "proveedor",
                            proyectoId: project.id,
                            folio: providerInvoiceData.folio,
                            uuid: providerInvoiceData.uuid,
                            subtotal: providerInvoiceData.subtotal,
                            iva: providerInvoiceData.iva,
                            monto: providerInvoiceData.monto,
                            fechaEmision: Timestamp.fromDate(providerInvoiceData.fechaEmision),
                            estado: "Pendiente",
                            urlXml: urlXml,
                            proveedorNombre: project.proveedorNombre,
                        });
                        updatePayload.facturasProveedorIds = arrayUnion(newInvoiceRef.id);
                    }
                } 
                else {
                    if (selectedClientInvoiceId) {
                        await updateDoc(doc(db, "facturas", selectedClientInvoiceId), { proyectosIds: arrayUnion(project.id) });
                        updatePayload.facturasClienteIds = arrayUnion(selectedClientInvoiceId);
                    }
                    if (selectedProviderInvoiceId && !isInternalProvider) {
                        await updateDoc(doc(db, "facturas", selectedProviderInvoiceId), { proyectosIds: arrayUnion(project.id) });
                        updatePayload.facturasProveedorIds = arrayUnion(selectedProviderInvoiceId);
                    }
                }
                
                const clientInvoiceReady = (project.facturasClienteIds?.length > 0) || clientInvoiceData || selectedClientInvoiceId;
                const providerInvoiceReady = isInternalProvider || (project.facturasProveedorIds?.length > 0) || providerInvoiceData || selectedProviderInvoiceId;

                if (clientInvoiceReady && providerInvoiceReady) {
                    updatePayload.estado = 'Facturado';
                }

                if (Object.keys(updatePayload).length > 0) {
                    await updateDoc(projectRef, updatePayload);
                }
                
                onFinalized();
                onClose();
            } catch (err) {
                setError("Ocurrió un error al guardar las facturas.");
                console.error("Error saving invoices:", err);
                setLoading(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                    <h3 className="text-lg font-bold mb-4">Gestionar Facturas: {project.npu}</h3>
                    
                    <div className="mb-4 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button onClick={() => setMode('upload')} className={`py-2 px-1 border-b-2 font-medium text-sm ${mode === 'upload' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                                Subir Nueva Factura (XML)
                            </button>
                            <button onClick={() => setMode('link')} className={`py-2 px-1 border-b-2 font-medium text-sm ${mode === 'link' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                                Enlazar Factura Existente
                            </button>
                        </nav>
                    </div>

                    {mode === 'upload' && (
                        <div className={`grid grid-cols-1 ${!isInternalProvider ? 'md:grid-cols-2' : ''} gap-6`}>
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-semibold text-gray-800">Factura a Cliente</h4>
                                {project.facturasClienteIds?.length > 0 ? <p className="text-green-600 font-semibold">✓ Factura ya adjuntada.</p> : (
                                    <>
                                        <label className="block text-sm font-medium">Subir archivo XML</label>
                                        <input type="file" name="clientXml" accept=".xml" onChange={(e) => handleFileChange(e, 'client')} className="block w-full text-sm"/>
                                        {clientInvoiceData && (
                                            <div className="text-xs bg-gray-50 p-2 rounded-md mt-2 space-y-1">
                                                <p><strong>Folio:</strong> {clientInvoiceData.folio}</p>
                                                <p><strong>Subtotal:</strong> ${clientInvoiceData.subtotal.toFixed(2)}</p>
                                                <p><strong>IVA:</strong> ${clientInvoiceData.iva.toFixed(2)}</p>
                                                <p><strong>Total:</strong> ${clientInvoiceData.monto.toFixed(2)}</p>
                                                <p><strong>Fecha:</strong> {clientInvoiceData.fechaEmision.toLocaleDateString()}</p>
                                                <p className="truncate"><strong>UUID:</strong> {clientInvoiceData.uuid}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {!isInternalProvider && (
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h4 className="font-semibold text-gray-800">Factura de Proveedor</h4>
                                    {project.facturasProveedorIds?.length > 0 ? <p className="text-green-600 font-semibold">✓ Factura ya adjuntada.</p> : (
                                        <>
                                            <label className="block text-sm font-medium">Subir archivo XML</label>
                                            <input type="file" name="providerXml" accept=".xml" onChange={(e) => handleFileChange(e, 'provider')} className="block w-full text-sm"/>
                                            {providerInvoiceData && (
                                                <div className="text-xs bg-gray-50 p-2 rounded-md mt-2 space-y-1">
                                                    <p><strong>Folio:</strong> {providerInvoiceData.folio}</p>
                                                    <p><strong>Subtotal:</strong> ${providerInvoiceData.subtotal.toFixed(2)}</p>
                                                    <p><strong>IVA:</strong> ${providerInvoiceData.iva.toFixed(2)}</p>
                                                    <p><strong>Total:</strong> ${providerInvoiceData.monto.toFixed(2)}</p>
                                                    <p><strong>Fecha:</strong> {providerInvoiceData.fechaEmision.toLocaleDateString()}</p>
                                                    <p className="truncate"><strong>UUID:</strong> {providerInvoiceData.uuid}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'link' && (
                        <div className={`grid grid-cols-1 ${!isInternalProvider ? 'md:grid-cols-2' : ''} gap-6`}>
                            <div className="space-y-2 p-4 border rounded-lg">
                                <h4 className="font-semibold text-gray-800">Enlazar Factura de Cliente</h4>
                                <select value={selectedClientInvoiceId} onChange={(e) => setSelectedClientInvoiceId(e.target.value)} className="block w-full border rounded-md p-2">
                                    <option value="">Seleccione una factura...</option>
                                    {linkableInvoices.filter(inv => inv.tipo === 'cliente').map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {`Folio: ${inv.folio} - ${inv.clienteNombre || inv.descripcion} - $${inv.monto.toFixed(2)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {!isInternalProvider && (
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <h4 className="font-semibold text-gray-800">Enlazar Factura de Proveedor</h4>
                                    <select value={selectedProviderInvoiceId} onChange={(e) => setSelectedProviderInvoiceId(e.target.value)} className="block w-full border rounded-md p-2">
                                        <option value="">Seleccione una factura...</option>
                                        {linkableInvoices.filter(inv => inv.tipo === 'proveedor').map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {`Folio: ${inv.folio} - ${inv.proveedorNombre || inv.descripcion} - $${inv.monto.toFixed(2)}`}
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
                        <button onClick={handleSave} className="bg-[#b0ef26] text-black font-bold py-2 px-4 rounded" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
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

// modal para subir facturas generales, y ligarlas o no a proyectos existentes
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
        (invoice.folio && String(invoice.folio).toLowerCase().includes(searchTerm.toLowerCase())) ||
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
        const [xmlFile, setXmlFile] = useState(null);
        const [invoiceData, setInvoiceData] = useState(null);
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

        useEffect(() => {
            if (invoiceData) {
                setFormData(prev => ({
                    ...prev,
                    folio: invoiceData.folio,
                    subtotal: invoiceData.subtotal,
                    iva: invoiceData.iva,                    
                    monto: invoiceData.monto,
                    fechaEmision: invoiceData.fechaEmision.toISOString().split('T')[0]
                }));
            }
        }, [invoiceData]);        

        const handleFileChange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            setXmlFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                const xmlText = event.target.result;
                const extractedData = parseInvoiceXML(xmlText);

                if (extractedData) {
                    setInvoiceData(extractedData);
                    setError('');
                } else {
                    setError('Error al leer el XML. Asegúrate de que es un archivo CFDI válido.');
                }
            };
            reader.readAsText(file);
        };

        const uploadFile = async (file, path) => {
            if (!file) return null;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, file);
            return getDownloadURL((await uploadTask).ref);
        };

        const handleSave = async () => {
            if (!invoiceData || !xmlFile || (formData.entidadId === '' || (formData.entidadId === 'otro' && !otherEntityName))) {
                setError("Debes subir un XML válido y seleccionar un cliente/proveedor.");
                return;
            }
            setLoading(true);
            try {
                const urlXml = await uploadFile(xmlFile, `facturas_${invoiceType}/${Date.now()}/${xmlFile.name}`);
                const entityName = formData.entidadId === 'otro' ? otherEntityName : entities.find(e => e.id === formData.entidadId)?.nombreCompleto || entities.find(e => e.id === formData.entidadId)?.nombre;

                await addDoc(collection(db, "facturas"), {
                    tipo: invoiceType,
                    proyectoId: "general",
                    folio: formData.folio,
                    uuid: invoiceData.uuid,
                    subtotal: Number(formData.subtotal),
                    iva: Number(formData.iva),
                    monto: Number(formData.monto),
                    fechaEmision: Timestamp.fromDate(new Date(formData.fechaEmision)),
                    estado: "Pendiente",
                    descripcion: formData.descripcion || '',
                    urlXml: urlXml,
                    urlPdf: '',
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
                        <label className="block text-sm font-medium">Subir archivo XML (la información se cargará automáticamente)</label>
                        <input type="file" name="xmlFile" accept=".xml" onChange={handleFileChange} className="block w-full text-sm"/>
                        
                        <hr/>
                        
                        <select value={formData.entidadId} onChange={(e) => setFormData(prev => ({...prev, entidadId: e.target.value}))} name="entidadId" className="block w-full border rounded-md p-2">
                            <option value="">Seleccione un {invoiceType}</option>
                            {entities.map(e => <option key={e.id} value={e.id}>{e.nombreCompleto || e.nombre}</option>)}
                            <option value="otro">Otro (especificar)</option>
                        </select>
                        {formData.entidadId === 'otro' && (
                            <input type="text" value={otherEntityName} onChange={(e) => setOtherEntityName(e.target.value)} placeholder={`Nombre del ${invoiceType}`} className="block w-full border rounded-md p-2"/>
                        )}
                        <input type="text" name="descripcion" placeholder="Descripción (ej: Renta de oficina)" value={formData.descripcion} onChange={(e) => setFormData(prev => ({...prev, descripcion: e.target.value}))} className="block w-full border rounded-md p-2"/>
                        
                        <input type="text" name="folio" placeholder="Folio (del XML)" value={formData.folio} disabled className="block w-full border rounded-md p-2 bg-gray-100"/>
                        <input type="number" name="subtotal" placeholder="Subtotal (del XML)" value={formData.subtotal || ''} disabled className="block w-full border rounded-md p-2 bg-gray-100"/>
                        <input type="number" name="iva" placeholder="IVA (del XML)" value={formData.iva || ''} disabled className="block w-full border rounded-md p-2 bg-gray-100"/>
                        <input type="number" name="monto" placeholder="Monto (del XML)" value={formData.monto} disabled className="block w-full border rounded-md p-2 bg-gray-100"/>
                        <input type="date" name="fechaEmision" value={formData.fechaEmision} disabled className="block w-full border rounded-md p-2 bg-gray-100"/>
                    </div>
                     <Alert message={error} type="error" onClose={() => setError('')} />
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose}>Cancelar</button>
                        <button onClick={handleSave} disabled={loading} className="bg-[#b0ef26] text-black font-bold py-2 px-4 rounded">{loading ? 'Guardando...' : 'Guardar Factura'}</button>
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
                fechaPromesaPago: formData.fechaPromesaPago ? Timestamp.fromDate(new Date(formData.fechaPromesaPago)) : deleteField(),
                fechaPagoReal: formData.fechaPagoReal ? Timestamp.fromDate(new Date(formData.fechaPagoReal)) : deleteField(),
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
                    await updateDoc(doc(db, PROYECTOS_COLLECTION, invoice.proyectoId), { 
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
    
    const getStatusInfo = (invoice) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (invoice.estado === 'Pagada') {
            return { text: 'Pagada', class: 'bg-green-100 text-green-800' };
        }
        if (invoice.estado === 'Cancelada') {
            return { text: 'Cancelada', class: 'bg-gray-100 text-gray-700' };
        }
        if (invoice.fechaPromesaPago?.toDate) {
            const promiseDate = invoice.fechaPromesaPago.toDate();
            promiseDate.setHours(0, 0, 0, 0);
            if (promiseDate < today) {
                return { text: 'Vencida', class: 'bg-red-100 text-red-800' };
            } else {
                return { text: 'Prog. a Pago', class: 'bg-blue-100 text-blue-800' };
            }
        }
        return { text: 'Pend. de Autorización', class: 'bg-yellow-100 text-yellow-800' };
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
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Subtotal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">IVA</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Emisión</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Promesa Pago</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Fecha Pago</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan="11">Cargando...</td></tr> : currentItems.map(invoice => {
                            const statusInfo = getStatusInfo(invoice);
                            return (
                                <tr key={invoice.id}>
                                <td className="px-6 py-4">{invoice.folio}</td>
                                <td className="px-6 py-4">{invoice.clienteNombre || invoice.proveedorNombre}</td>
                                <td className="px-6 py-4">{invoice.descripcion || (invoice.proyectoId !== 'general' ? 'Gasto de Proyecto' : '---')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(invoice.subtotal || 0).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(invoice.iva || 0).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${(invoice.monto || 0).toFixed(2)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaEmision)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaPromesaPago)}</td>
                                <td className="px-6 py-4">{formatDate(invoice.fechaPagoReal)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.class}`}>
                                        {statusInfo.text}
                                    </span>
                                </td>
                                <td className="px-6 py-4"><button onClick={() => setModalInvoice(invoice)} className="text-indigo-600">Gestionar</button></td>
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
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchProjects = () => {
        setLoading(true);
        const q = query(collection(db, PROYECTOS_COLLECTION), where("estado", "in", ["Terminado Internamente", "En Revisión Final"]));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        const filtered = projects.filter(p => 
            (p.npu?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.servicioNombre?.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const sortable = [...filtered];
        sortable.sort((a, b) => {
            const dateA = a.fase2_fechaFinTecnico || a.fase1_fechaFinTecnico;
            const dateB = b.fase2_fechaFinTecnico || b.fase1_fechaFinTecnico;
            const fieldA = dateA?.toDate() || new Date(0);
            const fieldB = dateB?.toDate() || new Date(0);
            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sortable;
    }, [projects, sortOrder, searchTerm]);

    const currentItems = sortedProjects.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handleSendToReview = async (projectId) => {
        setSubmittingId(projectId);
        try {
            await updateDoc(doc(db, PROYECTOS_COLLECTION, projectId), {
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
            onConfirm: () => {
                handleSendToReview(projectId);
                setConfirmingAction(null);
            }
        });
    };

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
                await updateDoc(doc(db, PROYECTOS_COLLECTION, project.id), updatePayload);
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Proyectos Listos para Documentar</h1>
                <div className="flex items-center space-x-4">
                    <input 
                        type="text"
                        placeholder="Buscar por NPU, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <div className="flex items-center">
                        <span className="text-sm mr-2">Mostrar:</span>
                        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 border border-gray-300 rounded-md">
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Ordenar por Fecha:</span>
                        <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-md text-sm bg-white shadow-sm">
                            {sortOrder === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
                        </button>
                    </div>
                </div>
            </div>

            {loading ? <p>Cargando...</p> : sortedProjects.length === 0 ? <p>No hay proyectos pendientes.</p> : (
                <>
                    <div className="overflow-x-auto bg-white rounded-lg shadow">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NPU</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos y correcciones</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                    {currentItems.map(project => {
                                    const statusClass = project.estado === 'En Revisión Final' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
                                    return (
                                        <tr key={project.id} className={project.motivoRechazo ? "bg-orange-50" : ""}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{project.npu}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{project.clienteNombre}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{project.servicioNombre}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                                                    {project.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-2 text-sm">
                                                    {project.fase1_urlEvidencia && (
                                                        <div>
                                                            <p className="font-semibold text-xs">Fase 1:</p>
                                                            <a href={project.fase1_urlEvidencia} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Evidencia 1</a>
                                                            <p>Nota Interna: <span className="font-semibold">{project.fase1_numeroNotaInterna || 'N/A'}</span></p>
                                                        </div>
                                                    )}
                                                    {project.fase2_urlEvidencia && (
                                                        <div>
                                                            <p className="font-semibold text-xs">Fase 2:</p>
                                                            <a href={project.fase2_urlEvidencia} target="_blank" rel="noopener noreferrer" className="text-blue-600">Ver Evidencia 2</a>
                                                            <p>Nota Interna: <span className="font-semibold">{project.fase2_numeroNotaInterna || 'N/A'}</span></p>
                                                        </div>
                                                    )}
                                                    {project.motivoRechazo && (
                                                        <div className="mt-2 p-2 bg-red-100 text-red-800 rounded-md text-xs border border-red-200">
                                                            <p className="font-bold">Requiere Corrección:</p>
                                                            <p>{project.motivoRechazo}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-4">
                                                    <button onClick={() => setModalProject(project)} className="text-indigo-600 hover:text-indigo-800">Gestionar Entrega</button>
                                                    {project.estado === 'Terminado Internamente' ? (
                                                        <button onClick={() => promptSendToReview(project.id)} disabled={submittingId === project.id} className="text-green-600 hover:text-green-800 disabled:opacity-50">
                                                            {submittingId === project.id ? 'Enviando...' : 'Enviar a Revisión'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-gray-500">Enviado</span>
                                                    )}
                                                </div>
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
                </>
            )}
            {modalProject && <ManageFinalDeliveryModal project={modalProject} onClose={() => setModalProject(null)} onFinalized={fetchProjects} />}
            {confirmingAction && <ConfirmationModal {...confirmingAction} onCancel={() => setConfirmingAction(null)} />}
        </div>
    );
};

// Este es el "router" principal. Recibe el rol activo del usuario
// y decide qué dashboard específico debe mostrar.
const Dashboard = ({ user, userData, selectedRole, setIsTechnicianWorking, selectedClientProfile }) => {    
    
    const renderDashboardByRole = () => {
        switch (selectedRole) {
            case 'administrador':
                return <AdminDashboard user={user} userData={userData} selectedRole={selectedRole} />;
            case 'cliente':
                return <ClientDashboard user={user} userData={selectedClientProfile} />;
            case 'directivo':
                return <DirectivoDashboard user={user} userData={userData} />;
            case 'ecotech':
                return <EcotechDashboard user={user} userData={userData} />;
            case 'supervisor':
                return <SupervisorDashboard user={user} userData={userData} selectedRole={selectedRole} />;
            case 'tecnico':
                return <TecnicoDashboard user={user} userData={userData} selectedRole={selectedRole} setIsWorkingState={setIsTechnicianWorking} />;
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
    const [isTechnicianCurrentlyWorking, setIsTechnicianCurrentlyWorking] = useState(false);
    const [selectedClientProfile, setSelectedClientProfile] = useState(null);

    // Este efecto se ejecuta una vez para verificar si hay una sesión activa.
    useEffect(() => {
        let unsubscribeSnapshot = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            unsubscribeSnapshot(); 

            if (currentUser) {
                setLoading(true);
                const userDocRef = doc(db, "usuarios", currentUser.uid);
                
                unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserData(data);
                        setUser(currentUser);

                        if (data.roles && data.roles.length > 0) {
                            setSelectedRole(data.roles[0]);
                        } else if (data.rol) {
                            setSelectedRole(data.rol);
                        }

                        if (data.rol === 'cliente') {
                            if (data.clientesAsociados && data.clientesAsociados.length > 0) {
                                const mainProfileRef = doc(db, "usuarios", data.clientesAsociados[0]);
                                getDoc(mainProfileRef).then(profileDoc => {
                                    if(profileDoc.exists()) {
                                        setSelectedClientProfile({ id: profileDoc.id, ...profileDoc.data() });
                                    }
                                    setLoading(false);
                                });
                            } else {
                                setSelectedClientProfile({ id: userDoc.id, ...data });
                                setLoading(false);
                            }
                        } else {
                            setLoading(false);
                        }
                    } else { 
                        signOut(auth); 
                        setLoading(false);
                    }
                }, (error) => { 
                    console.error("Error en listener de usuario (normal al salir):", error.message); 
                    setLoading(false); 
                });
            } else {
                setUser(null); setUserData(null); setSelectedRole(null);
                setSelectedClientProfile(null);
                setIsTechnicianCurrentlyWorking(false);
                setLoading(false);
            }
        });
        
        return () => {
            unsubscribeAuth();
            unsubscribeSnapshot();
        };
    }, []);

    useEffect(() => {
        const handleBeforeUnload = async (event) => {
            if (auth.currentUser && userData?.tareaActiva) {
                console.log("Cierre de ventana detectado, pausando tarea activa...");
                const userDocRef = doc(db, "usuarios", auth.currentUser.uid);
                const timeLogRef = doc(collection(db, "registrosDeTiempo"));

                await setDoc(timeLogRef, {
                    tecnicoId: auth.currentUser.uid,
                    projectId: userData.tareaActiva.projectId,
                    fechaInicio: userData.tareaActiva.inicio,
                    fechaFin: Timestamp.now(),
                });

                await updateDoc(userDocRef, { tareaActiva: deleteField() });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [userData]);    

    useEffect(() => {
        if (!user?.uid || !userData || (userData.roles && !userData.roles.includes('tecnico'))) {
            return;
        }

        const userStatusDatabaseRef = rtdbRef(rtdb, '/status/' + user.uid);
        const isOfflineForDatabase = {
            state: 'offline',
            last_changed: serverTimestamp(),
        };
        const isOnlineForDatabase = {
            state: 'online',
            last_changed: serverTimestamp(),
        };

        const connectedRef = rtdbRef(rtdb, '.info/connected');
        const unsubscribePresence = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                set(userStatusDatabaseRef, isOnlineForDatabase);

                onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase);
            }
        });

        return () => {
            unsubscribePresence();
            set(userStatusDatabaseRef, isOfflineForDatabase);
        };
    }, [user, userData]);
    
    // Muestro "Cargando..." mientras verifico la sesión.
    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#cdcdcd] text-gray-700">Cargando...</div>;
    }

    return (
        <div className="bg-[#c9c9c9] min-h-screen font-sans">
                <ToastContainer
                position="bottom-right"
                autoClose={8000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                />
             <Header
                user={user}
                userData={userData}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                isWorking={isTechnicianCurrentlyWorking}
                selectedClientProfile={selectedClientProfile}
                setSelectedClientProfile={setSelectedClientProfile} 
            />
            <main>
                {user && userData ? (
                    <Dashboard 
                        user={user} 
                        userData={userData} 
                        selectedRole={selectedRole} 
                        setIsTechnicianWorking={setIsTechnicianCurrentlyWorking}
                        selectedClientProfile={selectedClientProfile} 
                    />
                 ) : <AuthPage />}
            </main>
        </div>
    );

}
