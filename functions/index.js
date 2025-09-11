// functions/index.js (Cambia notf. email a pop ups)

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
  singleRoleSnapshot.forEach((doc) => usersMap.set(doc.id, {id: doc.id,
    ...doc.data()}));
  multiRoleSnapshot.forEach((doc) => usersMap.set(doc.id, {id: doc.id,
    ...doc.data()}));
  return Array.from(usersMap.values());
}

/**
 * @param {Array<string>} recipientIds
 * @param {string} message
 * @param {string} projectId
 */
async function createNotification(recipientIds, message, projectId) {
  if (!recipientIds || recipientIds.length === 0) {
    log("No hay destinatarios para la notificación.");
    return;
  }
  const batch = admin.firestore().batch();
  const notificationsRef = admin.firestore().collection("notificaciones");

  recipientIds.forEach((userId) => {
    const newNotifRef = notificationsRef.doc();
    batch.set(newNotifRef, {
      recipientId: userId,
      message: message,
      projectId: projectId || "",
      read: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    log(`Notificación '${message}' creada para ${recipientIds.length}
       usuario(s).`);
  } catch (err) {
    error("Error al crear notificaciones en batch:", err);
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

exports.notifyNewLogEntry = onDocumentCreated("bitacoras_proyectos/{logId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const logData = snap.data();
      const projectDoc = await
      admin.firestore().collection("proyectos").doc(logData.projectId).get();
      if (!projectDoc.exists) return;
      const projectData = projectDoc.data();
      const supervisors = await getUsersDataByRole("supervisor");
      const supervisorIds = supervisors.map((user) => user.id);
      const message =
       `Nueva Bitácora en ${projectData.npu} por ${logData.autorNombre}.`;
      await createNotification(supervisorIds, message, logData.projectId);
    });

exports.notifyProjectUpdate =
 onDocumentUpdated("proyectos/{projectId}", async (event) => {
   if (!event.data) {
     log("No data associated with the event.");
     return;
   }
   const projectId = event.params.projectId;
   const beforeData = event.data.before.data();
   const afterData = event.data.after.data();

   const notifyRole = async (role, message) => {
     const users = await getUsersDataByRole(role);
     const userIds = users.map((user) => user.id);
     await createNotification(userIds, message, projectId);
   };

   const notifyUsers = async (firebaseUserIds, message) => {
     await createNotification(firebaseUserIds, message, projectId);
   };

   // --- LÓGICA DE NOTIFICACIONES POR CAMBIO DE ESTADO ---

   if (beforeData.estado === "Cotización" && afterData.estado === "Activo") {
     const message =
      `Proyecto Activado: ${afterData.npu} está listo para ser asignado.`;
     await notifyRole("supervisor", message);
   }

   const techStatusAfter = afterData.tecnicosStatus || {};
   for (const techId in techStatusAfter) {
     if (
       techStatusAfter[techId] === "En Proceso" &&
       (beforeData.tecnicosStatus?.[techId] !== "En Proceso")
     ) {
       const techData = await getUserData(techId);
       const techName = techData ? techData.nombreCompleto : "un técnico";
       const message = `Tarea Iniciada: El técnico ${techName}
        ha comenzado a trabajar en ${afterData.npu}.`;
       await notifyRole("supervisor", message);
       break;
     }
   }

   if (beforeData.estado !== "Terminado Internamente" &&
     afterData.estado === "Terminado Internamente") {
     const message = `Tarea Finalizada: El proyecto $
     {afterData.npu} está listo para documentación.`;
     await notifyRole("supervisor", message);
     await notifyRole("practicante", message);
   }

   if (beforeData.estado !== "Pendiente de Factura" &&
     afterData.estado === "Pendiente de Factura") {
     const message =
      `Listo para Facturar: El proyecto ${afterData.npu} ha sido aprobado.`;
     await notifyRole("finanzas", message);
   }

   if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
     const message = `Proyecto Facturado: Se han gestionado las facturas para $
     {afterData.npu}.`;
     await notifyRole("supervisor", message);
     await notifyRole("finanzas", message);
   }

   const techsBefore = beforeData.asignadoTecnicosIds || [];
   const techsAfter = afterData.asignadoTecnicosIds || [];
   const newTechs = techsAfter.filter((id) => !techsBefore.includes(id));

   if (newTechs.length > 0) {
     const message =
      `Nueva Tarea: Se te ha asignado el proyecto ${afterData.npu}.`;
     await notifyUsers(newTechs, message);
   }
   // --- LÓGICA DE GESTIÓN DE ARCHIVOS ---

   if (beforeData.estado === "En Revisión Final" && (afterData.estado ===
     "Pendiente de Factura" || afterData.estado === "Archivado")) {
     log(`Proyecto ${afterData.npu} aprobado. Borrando evidencias de técnico.`);
     if (afterData
         .urlEvidenciaTecnico1
     ) await deleteFileFromUrl(afterData.urlEvidenciaTecnico1);
     if (afterData
         .urlEvidenciaTecnico2
     ) await deleteFileFromUrl(afterData.urlEvidenciaTecnico2);
   }

   if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
     log(`Proyecto ${afterData.npu}
       facturado. Archivando documentos iniciales.`);
     const filesToArchive =
      [afterData.urlCotizacionCliente, afterData.urlPOCliente,
        afterData.urlCotizacionProveedor, afterData.urlPOProveedor];
     for (const fileUrl of filesToArchive) {
       await archiveFileToColdline(fileUrl);
     }
   }
 });

