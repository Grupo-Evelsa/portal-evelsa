// functions/index.js

const {onDocumentCreated, onDocumentUpdated} =
 require("firebase-functions/v2/firestore");
const {log, error} = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// --- FUNCIONES AUXILIARES ---

/**
 * Obtiene los datos de un usuario desde Firestore.
 * @param {string} firebaseUserId El UID del usuario en Firebase.
 * @return {object|null} Los datos del usuario o null.
 */
async function getUserData(firebaseUserId) {
  const userDoc =
   await admin.firestore().collection("usuarios").doc(firebaseUserId).get();
  return userDoc.exists ? userDoc.data() : null;
}

/**
 * Obtiene todos los usuarios de un rol específico,
 * @param {string} role El rol a buscar (ej. "supervisor").
 * @return {Array<object>} Una lista de los datos de los usuarios.
 */
async function getUsersDataByRole(role) {
  const usersRef = admin.firestore().collection("usuarios");
  const singleRoleQuery = usersRef.where("rol", "==", role).get();
  const multiRoleQuery = usersRef.where("roles", "array-contains", role).get();
  const [singleRoleSnapshot, multiRoleSnapshot] = await Promise.all([
    singleRoleQuery,
    multiRoleQuery,
  ]);
  const usersMap = new Map();
  singleRoleSnapshot.forEach((doc) => usersMap.set(doc.id, doc.data()));
  multiRoleSnapshot.forEach((doc) => usersMap.set(doc.id, doc.data()));
  return Array.from(usersMap.values());
}


/**
 * Crea un documento en la colección 'mail' para que la extensión lo envíe.
 * @param {Array<string>} emails - La lista de correos de los destinatarios.
 * @param {string} subject - El asunto del correo.
 * @param {string} html - El cuerpo del correo en formato HTML.
 */
async function sendEmail(emails, subject, html) {
  if (!emails || emails.length === 0) {
    log("No hay destinatarios para enviar el correo.");
    return;
  }
  try {
    // La extensión "Trigger Email" vigila esta colección.
    await admin.firestore().collection("mail").add({
      to: emails,
      message: {
        subject: subject,
        html: html,
      },
    });
    log(`Correo para '${subject}' encolado para ${emails.join(", ")}.`);
  } catch (err) {
    error("Error al encolar correo:", err);
  }
}


/**
 * Borra un archivo en Cloud Storage a partir de su URL de descarga.
 * @param {string} fileUrl La URL completa del archivo a borrar.
 */
async function deleteFileFromUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes("firebasestorage.googleapis.com")) {
    log("URL de archivo inválida o vacía, no se puede borrar:", fileUrl);
    return;
  }
  try {
    const bucket = admin.storage().bucket();
    const decodedUrl = decodeURIComponent(fileUrl);
    const filePath = decodedUrl.split("/o/")[1].split("?")[0];
    await bucket.file(filePath).delete();
    log(`Archivo borrado exitosamente: ${filePath}`);
  } catch (err) {
    if (err.code === 404) {
      log(`El archivo no se encontró: ${fileUrl}`);
    } else {
      error(`Error al borrar el archivo ${fileUrl}:`, err);
    }
  }
}

/**
 * Cambia la clase de almacenamiento de un archivo a COLDLINE.
 * @param {string} fileUrl La URL completa del archivo a archivar.
 */
async function archiveFileToColdline(fileUrl) {
  if (!fileUrl || !fileUrl.includes("firebasestorage.googleapis.com")) {
    log("URL de archivo inválida o vacía, no se puede archivar:", fileUrl);
    return;
  }
  try {
    const bucket = admin.storage().bucket();
    const decodedUrl = decodeURIComponent(fileUrl);
    const filePath = decodedUrl.split("/o/")[1].split("?")[0];
    await bucket.file(filePath).setStorageClass("COLDLINE");
    log(`Archivo archivado a COLDLINE: ${filePath}`);
  } catch (err) {
    error(`Error al archivar el archivo ${fileUrl}:`, err);
  }
}

// --- TRIGGERS ---

exports.notifyNewLogEntry =
 onDocumentCreated("bitacoras_proyectos/{logId}", async (event) => {
   const snap = event.data;
   if (!snap) return;
   const logData = snap.data();
   const projectDoc =
   await admin.firestore().collection("proyectos").doc(logData.projectId).get();
   if (!projectDoc.exists) return;
   const projectData = projectDoc.data();
   const supervisors = await getUsersDataByRole("supervisor");
   const emails = supervisors.map((user) => user.email).filter(Boolean);

   const subject = `Nueva Bitácora en el Proyecto ${projectData.npu}`;
   const html = `<p>Hola,</p><p>El usuario <strong>${logData.autorNombre}
   </strong> ha añadido una nueva nota en la bitácora del proyecto <strong>
   ${projectData.npu}
   </strong>.</p><p>Por favor, revisa la comunicación en el portal.</p>`;
   await sendEmail(emails, subject, html);
 });

exports.notifyProjectUpdate =
 onDocumentUpdated("proyectos/{projectId}", async (event) => {
   if (!event.data) {
     log("No data associated with the event.");
     return;
   }
   const beforeData = event.data.before.data();
   const afterData = event.data.after.data();

   // Función auxiliar para notificar a un rol completo
   const notifyRole = async (role, subject, html) => {
     const users = await getUsersDataByRole(role);
     const emails = users.map((user) => user.email).filter(Boolean);
     await sendEmail(emails, subject, html);
   };

   // Función auxiliar para notificar a una lista específica de usuarios por ID
   const notifyUsers = async (firebaseUserIds, subject, html) => {
     const emails = [];
     for (const userId of firebaseUserIds) {
       const userData = await getUserData(userId);
       if (userData && userData.email) {
         emails.push(userData.email);
       }
     }
     await sendEmail(emails, subject, html);
   };

   // --- LÓGICA DE NOTIFICACIONES POR CAMBIO DE ESTADO ---

   // A. Proyecto Activado -> Notificar a Supervisores
   if (beforeData.estado === "Cotización" && afterData.estado === "Activo") {
     const subject = `Proyecto Activado: ${afterData.npu}`;
     const html = `<p>El proyecto <strong>${afterData.npu}</strong>
      (${afterData.clienteNombre})
       ha sido activado y está listo para ser asignado a un técnico.</p>`;
     await notifyRole("supervisor", subject, html);
   }

   // B. Técnico Inicia Tarea -> Notificar a Supervisores
   const techStatusAfter = afterData.tecnicosStatus || {};
   for (const techId in techStatusAfter) {
     if (
       techStatusAfter[techId] === "En Proceso" &&
       (beforeData.tecnicosStatus?.[techId] !== "En Proceso")
     ) {
       const techData = await getUserData(techId);
       const techName = techData ? techData.nombreCompleto : "un técnico";
       const subject = `Tarea Iniciada en ${afterData.npu}`;
       const html = `<p>El técnico <strong>${techName}
       </strong> ha comenzado a trabajar en el proyecto <strong>
       ${afterData.npu}</strong>.</p>`;
       await notifyRole("supervisor", subject, html);
       break; // Solo notificar una vez por actualización
     }
   }

   // C. Tarea Finalizada -> Notificar a Supervisores y Practicantes
   if (
     beforeData.estado !== "Terminado Internamente" &&
     afterData.estado === "Terminado Internamente"
   ) {
     const subject = `Tarea Finalizada: ${afterData.npu}`;
     const html = `<p>El proyecto <strong>${afterData.npu}
     </strong> ha sido completado por el equipo técnico y 
     está listo para la preparación de documentos.</p>`;
     await notifyRole("supervisor", subject, html);
     await notifyRole("practicante", subject, html);
   }

   // D. Listo para Facturar -> Notificar a Finanzas
   if (
     beforeData.estado !== "Pendiente de Factura" &&
     afterData.estado === "Pendiente de Factura"
   ) {
     const subject = `Proyecto Listo para Facturar: ${afterData.npu}`;
     const html = `<p>El proyecto <strong>${afterData.npu}
     </strong> ha sido aprobado y está pendiente de gestión de factura.</p>`;
     await notifyRole("finanzas", subject, html);
   }

   // E. Proyecto Facturado -> Notificar a Supervisores y Finanzas
   if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
     const subject = `Proyecto Facturado: ${afterData.npu}`;
     const html = `<p>Se han gestionado las facturas para el proyecto <strong>
     ${afterData.npu}</strong>.</p>`;
     await notifyRole("supervisor", subject, html);
     await notifyRole("finanzas", subject, html);
   }

   // F. Nueva Asignación -> Notificar a los nuevos técnicos asignados
   const techsBefore = beforeData.asignadoTecnicosIds || [];
   const techsAfter = afterData.asignadoTecnicosIds || [];
   const newTechs = techsAfter.filter((id) => !techsBefore.includes(id));

   if (newTechs.length > 0) {
     const subject = `Nueva Tarea Asignada: ${afterData.npu}`;
     const html = `<p>Hola, se te ha asignado el proyecto <strong>
     ${afterData.npu}</strong> (${afterData.servicioNombre})
     . Por favor, revísalo en el portal.</p>`;
     await notifyUsers(newTechs, subject, html);
   }
   // --- LÓGICA DE GESTIÓN DE ARCHIVOS ---

   // G. Borrar evidencia del técnico cuando el Admin aprueba
   if (
     beforeData.estado === "En Revisión Final" &&
     (afterData.estado === "Pendiente de Factura" ||
       afterData.estado === "Archivado")
   ) {
     log(`Proyecto ${afterData.npu} aprobado. Borrando evidencias de técnico.`);
     if (afterData.urlEvidenciaTecnico1) {
       await deleteFileFromUrl(afterData.urlEvidenciaTecnico1);
     }
     if (afterData.urlEvidenciaTecnico2) {
       await deleteFileFromUrl(afterData.urlEvidenciaTecnico2);
     }
   }

   // H. Archivar documentos iniciales cuando el proyecto se factura
   if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
     log(`Proyecto ${afterData.npu}
       facturado. Archivando documentos iniciales.`);
     const filesToArchive = [
       afterData.urlCotizacionCliente,
       afterData.urlPOCliente,
       afterData.urlCotizacionProveedor,
       afterData.urlPOProveedor,
     ];
     for (const fileUrl of filesToArchive) {
       await archiveFileToColdline(fileUrl);
     }
   }
 });

